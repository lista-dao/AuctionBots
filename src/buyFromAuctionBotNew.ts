import { ethers, BigNumber } from "ethers";

import CLIP_ABI from "../abis/clipAbi.json";
import SPOT_ABI from "../abis/spotAbi.json";
import INTERACTION_ABI from "../abis/interactionAbi.json";
import ORACLE_ABI from "../abis/oracleAbi.json";
import HAY_ABI from "../abis/hayAbi.json";
import {
  PRIVATE_KEY,
  WEBSOCKET_URL,
  BUY_FROM_AUCTION_INTERVAL,
  SPOT,
  HAY,
  TOKENS,
  INTERACTION,
  RPC_URL,
} from "./envVars";

interface Auction {
  id: BigNumber;
  clip: ethers.Contract;
  oracle: ethers.Contract;
  tokenAddress: string;
}

const ten = BigNumber.from(10);
const wad = ten.pow(18);

const provider = new ethers.providers.WebSocketProvider(WEBSOCKET_URL);
const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const rpcWallet = new ethers.Wallet(PRIVATE_KEY, rpcProvider);

const spotContract = new ethers.Contract(SPOT, SPOT_ABI, rpcWallet);
const interaction = new ethers.Contract(
  INTERACTION,
  INTERACTION_ABI,
  rpcWallet
);
const hay = new ethers.Contract(HAY, HAY_ABI, rpcWallet);

const auctions = new Map<number, Auction>();

const gasLimit = BigNumber.from("700000");
const pricePercent = BigNumber.from("95");

let pendingTxExist = false;

setInterval(() => {
  for (const [idNum, auction] of auctions) {
    console.log("auction id is ->", auction.id.toString());
    const { id, clip, oracle } = auction;
    Promise.all([
      clip.getStatus(id),
      oracle.peek(),
      hay.balanceOf(wallet.address),
    ]).then(
      ([status, peekRes, botBalance]: [
        status: Array<any>,
        peekRes: Array<any>,
        botBalance: BigNumber
      ]) => {
        botBalance = BigNumber.from(botBalance);
        const actualPrice = BigNumber.from(peekRes[0]);
        const needsRedo: boolean = status[0];
        const auctionPrice = BigNumber.from(status[1]).div(10 ** 9);
        const lot = BigNumber.from(status[2]);
        console.log("Actual price is: ", actualPrice.toString());
        console.log("Auction price is:", auctionPrice.toString());
        console.log("Needs redos:     ", needsRedo);
        console.log("lot is:          ", lot.toString());
        console.log("pending tx exist:", pendingTxExist);

        if (
          !needsRedo &&
          !lot.isZero() &&
          !pendingTxExist &&
          actualPrice.mul(pricePercent).div(100).gte(auctionPrice)
        ) {
          pendingTxExist = true;
          const maxCollateralAmount = botBalance.mul(wad).div(auctionPrice);
          const collateralAmount = maxCollateralAmount.gt(lot)
            ? lot
            : maxCollateralAmount;
          console.log("Starting buy");
          auctions.delete(idNum);
          interaction
            .buyFromAuction(
              auction.tokenAddress,
              id,
              collateralAmount,
              auctionPrice.mul(10 ** 9),
              wallet.address,
              { gasLimit }
            )
            .then((tx: ethers.providers.TransactionResponse) => {
              console.log("Transaction sended");
              return tx.wait();
            })
            .then((tx: ethers.providers.TransactionReceipt) => {
              pendingTxExist = false;
              console.log("Transaction hash is:", tx.transactionHash);
            })
            .catch((err: any) => {
              pendingTxExist = false;
              console.log("Error!!");
              console.log("_________________________________________");
              console.log(err);
              console.log("_________________________________________");
            });
        } else if (needsRedo || lot.isZero()) {
          console.log("removing auction");
          auctions.delete(idNum);
        }
      }
    );
  }
}, BUY_FROM_AUCTION_INTERVAL);

const main = async () => {
  for (const tokenInfo of TOKENS) {
    Promise.all([
      spotContract.ilks(tokenInfo.ilk),
      hay.allowance(wallet.address, interaction.address),
    ]).then(
      ([spotIlk, allowance]: [spotIlk: Array<any>, allowance: BigNumber]) => {
        console.log(spotIlk[0]);

        allowance = BigNumber.from(allowance);
        const oracle = new ethers.Contract(spotIlk[0], ORACLE_ABI, rpcWallet);
        const clip = new ethers.Contract(tokenInfo.clip, CLIP_ABI, wallet);
        if (!allowance.eq(ethers.constants.MaxUint256)) {
          hay.approve(INTERACTION, ethers.constants.MaxUint256).then(() => {
            console.log("successful approve");
          });
        } else {
          console.log("no need of approve");
        }
        clip.on("Kick", (id) => {
          console.log(`Auction with id ${id.toString()} started`);

          if (!auctions.has(id.toNumber())) {
            auctions.set(id.toNumber(), {
              id: BigNumber.from(id),
              tokenAddress: tokenInfo.addr,
              clip,
              oracle,
            });
          }
        });
      }
    );
  }
};

main();
