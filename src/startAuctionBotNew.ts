import { ethers, BigNumber } from "ethers";
import axios, { AxiosResponse } from "axios";
import https from "https";

import CLIP_ABI from "../abis/clipAbi.json";
import DOG_ABI from "../abis/dogAbi.json";
import VAT_ABI from "../abis/vatAbi.json";
import SPOT_ABI from "../abis/spotAbi.json";
import INTERACTION_ABI from "../abis/interactionAbi.json";
import AGGREGATOR_ABI from "../abis/chainlinkAggregatorAbi.json";
import {
  PRIVATE_KEY,
  START_AUCTION_INTERVAL,
  WEBSOCKET_URL,
  API,
  DOG,
  VAT,
  SPOT,
  INTERACTION,
  CHAINLINK_AGGREGATOR,
  TOKENS,
  RPC_URL,
} from "./envVars";

const ten = BigNumber.from(10);
const wad = ten.pow(18);
const ray = ten.pow(27);

const provider = new ethers.providers.WebSocketProvider(WEBSOCKET_URL);
const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const rpcWallet = new ethers.Wallet(PRIVATE_KEY, rpcProvider);

const min = (num1: BigNumber, num2: BigNumber): BigNumber => {
  return num1.lt(num2) ? num1 : num2;
};

const wmul = (num1: BigNumber, num2: BigNumber): BigNumber => {
  return num1.mul(num2).div(wad);
};

const GAS_LIMIT = BigNumber.from("700000");

const aggregator = new ethers.Contract(
  CHAINLINK_AGGREGATOR,
  AGGREGATOR_ABI,
  rpcWallet
);

const spotContract = new ethers.Contract(SPOT, SPOT_ABI, wallet);
const dog = new ethers.Contract(DOG, DOG_ABI, rpcWallet);
const vat = new ethers.Contract(VAT, VAT_ABI, rpcWallet);
const interaction = new ethers.Contract(
  INTERACTION,
  INTERACTION_ABI,
  rpcWallet
);

const agent = new https.Agent({
  rejectUnauthorized: false,
});
const instance = axios.create({
  baseURL: API,
  httpsAgent: agent,
});
const getUsersInDebt = () => {
  return instance.get("/borrowers_addresses", {
    headers: {
      "Content-Type": "application/json",
    },
  });
};

const getTokenInfoByIlk = (ilk: string) => {
  for (const tokenInfo of TOKENS) {
    if (tokenInfo.ilk === ilk) {
      return tokenInfo;
    }
  }
  return undefined;
};

const main = async () => {
  let nonce = await rpcWallet.getTransactionCount();
  const startAuction = (
    addr: string,
    ilk: string,
    clipAddr: string,
    bnbPrice: BigNumber,
    Hole: BigNumber,
    Dirt: BigNumber,
    responseData: Record<string, string>[]
  ) => {
    const clip = new ethers.Contract(clipAddr, CLIP_ABI, rpcWallet);
    Promise.all([
      dog.ilks(ilk),
      vat.ilks(ilk),
      clip.tip(),
      clip.chip(),
      provider.getGasPrice(),
    ]).then(
      ([dogIlk, vatIlk, tip, chip, gasPrice]: [
        dogIlk: Array<any>,
        vatIlk: Array<any>,
        tip: BigNumber,
        chip: BigNumber,
        gasPrice: BigNumber
      ]) => {
        tip = BigNumber.from(tip);
        chip = BigNumber.from(chip);
        for (const data of responseData) {
          const userAddress = data.user_address;
          vat.urns(ilk, userAddress).then((urn: any) => {
            console.log("user address:", userAddress);
            const ink = BigNumber.from(urn[0]);
            const art = BigNumber.from(urn[1]);
            const rate = BigNumber.from(vatIlk[1]);
            const spot = BigNumber.from(vatIlk[2]);
            const dust = BigNumber.from(vatIlk[4]);
            const chop = BigNumber.from(dogIlk[1]);
            if (!spot.isZero() && ink.mul(spot).lt(art.mul(rate))) {
              // calculate tab
              const room = min(
                Hole.sub(Dirt),
                BigNumber.from(dogIlk[2]).sub(BigNumber.from(dogIlk[3]))
              );
              let dart = min(art, room.mul(wad).div(rate).div(chop));
              if (art.gt(dart) && art.sub(dart).mul(rate).lt(dust)) {
                dart = art;
              }
              const due = dart.mul(rate);
              const tab = due.mul(chop).div(wad);
              // calculate USB incentives amount
              const usbIncentiveAmount = tip.add(wmul(tab, chip)).div(ray);
              // calculate transaction cost
              const txCost = gasPrice.mul(GAS_LIMIT).mul(bnbPrice).div(wad);
              if (txCost.lt(usbIncentiveAmount)) {
                console.log("Starting Auction with nonce:", nonce);
                interaction
                  .startAuction(addr, userAddress, wallet.address, {
                    gasLimit: GAS_LIMIT,
                    nonce: nonce++,
                  })
                  .then((tx: ethers.providers.TransactionResponse) => {
                    console.log("Transaction sended");
                    return tx.wait();
                  })
                  .then((tx: ethers.providers.TransactionReceipt) => {
                    console.log("Transaction hash is:", tx.transactionHash);
                  })
                  .catch((err: any) => {
                    console.error("Error!!");
                    console.error("_________________________________________");
                    console.error(err);
                    console.error("_________________________________________");
                  });
              } else {
                console.log("unprofitable");
              }
            } else {
              console.log(userAddress, "no need for liquidation");
            }
          });
        }
      }
    );
  };
  setInterval(() => {
    Promise.all([aggregator.latestRoundData(), dog.Hole(), dog.Dirt()]).then(
      ([roundData, Hole, Dirt]: [
        roundData: Record<string, any>,
        Hole: BigNumber,
        Dirt: BigNumber
      ]) => {
        console.log("SetInterval trigger!");
        getUsersInDebt().then((response) => {
          Hole = BigNumber.from(Hole);
          Dirt = BigNumber.from(Dirt);
          const responseData = response.data;
          const bnbPrice = BigNumber.from(roundData.answer).mul(10 ** 10);
          for (const tokenInfo of TOKENS) {
            startAuction(
              tokenInfo.addr,
              tokenInfo.ilk,
              tokenInfo.clip,
              bnbPrice,
              Hole,
              Dirt,
              responseData
            );
          }
        });
      }
    );
  }, START_AUCTION_INTERVAL);

  spotContract.on("Poke", (ilk, vat, spot) => {
    console.log("Poke event triggered");
    const tokenInfo = getTokenInfoByIlk(ilk);
    if (!tokenInfo) {
      console.log("Unsupported token ilk");
      return;
    }
    Promise.all([aggregator.latestRoundData(), dog.Hole(), dog.Dirt()]).then(
      ([roundData, Hole, Dirt]: [
        roundData: Record<string, any>,
        Hole: BigNumber,
        Dirt: BigNumber
      ]) => {
        getUsersInDebt().then((response) => {
          const responseData = response.data;
          Hole = BigNumber.from(Hole);
          Dirt = BigNumber.from(Dirt);
          const bnbPrice = BigNumber.from(roundData.answer).mul(10 ** 10);
          startAuction(
            tokenInfo.addr,
            tokenInfo.ilk,
            tokenInfo.clip,
            bnbPrice,
            Hole,
            Dirt,
            responseData
          );
        });
      }
    );
  });
};

main();
