import "dotenv/config";
import { ethers } from "ethers";

const websocketUrl = process.env.WEBSOCKET_URL;
const privateKey = process.env.PRIVATE_KEY;
const collateralAddress = process.env.COLLATERAL_ADDRESS;
const collateralName = process.env.COLLATERAL_NAME;

if (!websocketUrl) {
  throw new Error("websocket url does not provided");
}

if (!privateKey) {
  throw new Error("private key does not provided");
}

if (!collateralAddress) {
  throw new Error("collateral address does not provided");
}

if (!collateralName) {
  throw new Error("collateral name does not provided");
}

const collateralIlk = ethers.utils.formatBytes32String(collateralName);

export const WEBSOCKET_URL = websocketUrl;
export const PRIVATE_KEY = privateKey;
export const COLLATERAL_ADDRESS = collateralAddress;
export const COLLATERAL_NAME = collateralName;
export const COLLATERAL_ILK = collateralIlk;

export default {
  WEBSOCKET_URL,
  PRIVATE_KEY,
  COLLATERAL_ADDRESS,
  COLLATERAL_NAME,
  COLLATERAL_ILK,
};
