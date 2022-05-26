import { ethers, BigNumber } from "ethers";
import {
  SPOT,
  DOG,
  USB,
  INTERACTION,
  AUCTION_PROXY,
} from "../addresses/addresses.json";

import CLIP_ABI from "../abis/clipAbi.json";
import SPOT_ABI from "../abis/spotAbi.json";
import DOG_ABI from "../abis/dogAbi.json";
import INTERACTION_ABI from "../abis/interactionAbi.json";
import ORACLE_ABI from "../abis/oracleAbi.json";
import USB_ABI from "../abis/usbAbi.json";
import {
  COLLATERAL_ADDRESS,
  COLLATERAL_ILK,
  PRIVATE_KEY,
  WEBSOCKET_URL,
} from "./envVars";

interface Auction {
  id: BigNumber;
  clip: ethers.Contract;
  oracle: ethers.Contract;
}

const ten = BigNumber.from(10);
const wad = ten.pow(18);

const wsProvider = new ethers.providers.WebSocketProvider(WEBSOCKET_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, wsProvider);

const spotContract = new ethers.Contract(SPOT, SPOT_ABI, wallet);
const dog = new ethers.Contract(DOG, DOG_ABI, wallet);
const interaction = new ethers.Contract(INTERACTION, INTERACTION_ABI, wallet);
const usb = new ethers.Contract(USB, USB_ABI, wallet);

const auctions = new Map<number, Auction>();

const gasLimit = BigNumber.from("500000");
const pricePercent = BigNumber.from("95");
const interval = 3000;

let pendingTxExist = false;

setInterval(() => {
  console.log("Trying!");
  for (const [idNum, auction] of auctions) {
    console.log("auction id is ->", auction.id.toString());
    const { id, clip, oracle } = auction;
    Promise.all([
      clip.getStatus(id),
      oracle.peek(),
      usb.balanceOf(wallet.address),
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
              COLLATERAL_ADDRESS,
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
}, interval);

const main = async () => {
  Promise.all([
    spotContract.ilks(COLLATERAL_ILK),
    dog.ilks(COLLATERAL_ILK),
    usb.allowance(wallet.address, interaction.address),
  ]).then(
    ([spotIlk, dogIlk, allowance]: [
      spotIlk: Array<any>,
      dogIlk: Array<any>,
      allowance: BigNumber
    ]) => {
      console.log(spotIlk[0]);
      console.log(dogIlk[0]);

      allowance = BigNumber.from(allowance);
      const oracle = new ethers.Contract(spotIlk[0], ORACLE_ABI, wallet);
      const clip = new ethers.Contract(dogIlk[0], CLIP_ABI, wallet);
      if (!allowance.eq(ethers.constants.MaxUint256)) {
        usb.approve(AUCTION_PROXY, ethers.constants.MaxUint256).then(() => {
          console.log("successful approve");
        });
      } else {
        console.log("no need of approve");
      }
      clip.on("Kick", (id, top, tab, lot, usr, kpr, coin) => {
        console.log(`Auction with id ${id.toString()} started`);

        if (!auctions.has(id.toNumber())) {
          auctions.set(id.toNumber(), {
            id: BigNumber.from(id),
            clip,
            oracle,
          });
        }
      });
    }
  );
};

main();
