import { ethers, BigNumber } from "ethers";
import {
  DOG,
  VAT,
  INTERACTION,
  CHAINLINK_AGGREGATOR,
  TOKENS,
} from "../addresses/addresses.json";

import CLIP_ABI from "../abis/clipAbi.json";
import DOG_ABI from "../abis/dogAbi.json";
import VAT_ABI from "../abis/vatAbi.json";
import INTERACTION_ABI from "../abis/interactionAbi.json";
import AGGREGATOR_ABI from "../abis/chainlinkAggregatorAbi.json";
import { PRIVATE_KEY, RPC_URL, START_AUCTION_INTERVAL } from "./envVars";

const ten = BigNumber.from(10);
const wad = ten.pow(18);
const ray = ten.pow(27);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const min = (num1: BigNumber, num2: BigNumber): BigNumber => {
  return num1.lt(num2) ? num1 : num2;
};

const wmul = (num1: BigNumber, num2: BigNumber): BigNumber => {
  return num1.mul(num2).div(wad);
};

const toWad = (num: string) => {
  return ethers.utils.parseUnits(num, 18);
};

const main = async () => {
  const GAS_LIMIT = BigNumber.from("700000");

  const aggregator = new ethers.Contract(
    CHAINLINK_AGGREGATOR,
    AGGREGATOR_ABI,
    wallet
  );
  const dog = new ethers.Contract(DOG, DOG_ABI, wallet);
  const vat = new ethers.Contract(VAT, VAT_ABI, wallet);
  const interaction = new ethers.Contract(INTERACTION, INTERACTION_ABI, wallet);
  setInterval(() => {
    Promise.all([
      aggregator.latestRoundData(),
      dog.Hole(),
      dog.Dirt(),
      interaction.getUsersInDebt(), // need to have the users list
      wallet.getTransactionCount(),
    ]).then(
      ([roundData, Hole, Dirt, users, nonce]: [
        roundData: Record<string, any>,
        Hole: BigNumber,
        Dirt: BigNumber,
        users: Array<string>,
        nonce: number
      ]) => {
        Hole = BigNumber.from(Hole);
        Dirt = BigNumber.from(Dirt);
        const userAddresses = users;
        const bnbPrice = BigNumber.from(roundData.answer).mul(10 ** 10);
        for (const tokenInfo of TOKENS) {
          const clip = new ethers.Contract(tokenInfo.clip, CLIP_ABI, wallet);
          Promise.all([
            dog.ilks(tokenInfo.ilk),
            vat.ilks(tokenInfo.ilk),
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
              for (const userAddress of userAddresses) {
                vat.urns(tokenInfo.ilk, userAddress).then((urn: any) => {
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
                    const usbIncentiveAmount = tip
                      .add(wmul(tab, chip))
                      .div(ray);
                    // calculate transaction cost
                    const txCost = gasPrice
                      .mul(GAS_LIMIT)
                      .mul(bnbPrice)
                      .div(wad);
                    if (txCost.lt(usbIncentiveAmount)) {
                      console.log("Starting Auction with nonce:", nonce);
                      interaction
                        .startAuction(
                          tokenInfo.addr,
                          userAddress,
                          wallet.address,
                          {
                            gasLimit: GAS_LIMIT,
                            nonce: nonce++,
                          }
                        )
                        .then((tx: ethers.providers.TransactionResponse) => {
                          console.log("Transaction sended");
                          return tx.wait();
                        })
                        .then((tx: ethers.providers.TransactionReceipt) => {
                          console.log(
                            "Transaction hash is:",
                            tx.transactionHash
                          );
                        })
                        .catch((err: any) => {
                          console.error("Error!!");
                          console.error(
                            "_________________________________________"
                          );
                          console.error(err);
                          console.error(
                            "_________________________________________"
                          );
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
        }
      }
    );
  }, START_AUCTION_INTERVAL);
};

main();
