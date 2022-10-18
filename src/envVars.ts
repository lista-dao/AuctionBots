import "dotenv/config";

interface TokenInfo {
  addr: string;
  clip: string;
  ilk: string;
}

const privateKey = process.env.PRIVATE_KEY;
const websocketUrl = process.env.WEBSOCKET_URL;
const rpcUrl = process.env.RPC_URL;
const api = process.env.API;

// Addresses
const vat = process.env.VAT;
const hay = process.env.HAY;
const interaction = process.env.INTERACTION;
const dog = process.env.DOG;
const aggregator = process.env.CHAINLINK_AGGREGATOR;
const spot = process.env.SPOT;
// Tokens
const token0Addr = process.env.TOKEN0_ADDR;
const token0Clip = process.env.TOKEN0_CLIP;
const token0Ilk = process.env.TOKEN0_ILK;
const token1Addr = process.env.TOKEN1_ADDR;
const token1Clip = process.env.TOKEN1_CLIP;
const token1Ilk = process.env.TOKEN1_ILK;
const tokenInfos: TokenInfo[] = [];

let startAuctionInterval = process.env.START_AUCTION_INTERVAL;
let buyFromAuctionInterval = process.env.BUY_FROM_AUCTION_INTERVAL;

if (!privateKey) {
  throw new Error("private key does not provided");
}

if (!websocketUrl) {
  throw new Error("websocket url does not provided");
}

if (!rpcUrl) {
  throw new Error("rpc url does not provided");
}

if (!api) {
  throw new Error("api url does not provided");
}

if (!vat || !hay || !interaction || !dog || !aggregator || !spot) {
  throw new Error("Some of addresses are not provided");
}

if (token0Addr) {
  if (!token0Clip || !token0Ilk) {
    throw new Error("clip or ilk is not provided for token0");
  }
  tokenInfos.push({
    addr: token0Addr,
    clip: token0Clip,
    ilk: token0Ilk,
  });
}

if (token1Addr) {
  if (!token1Clip || !token1Ilk) {
    throw new Error("clip or ilk is not provided for token1");
  }
  tokenInfos.push({
    addr: token1Addr,
    clip: token1Clip,
    ilk: token1Ilk,
  });
}

if (tokenInfos.length === 0) {
  throw new Error("no token address was provided");
}

if (!startAuctionInterval) {
  startAuctionInterval = "86400000";
}

if (!buyFromAuctionInterval) {
  buyFromAuctionInterval = "3000";
}

export const WEBSOCKET_URL = websocketUrl;
export const RPC_URL = rpcUrl;
export const PRIVATE_KEY = privateKey;
export const API = api;
export const START_AUCTION_INTERVAL = parseInt(startAuctionInterval);
export const BUY_FROM_AUCTION_INTERVAL = parseInt(buyFromAuctionInterval);
export const VAT = vat;
export const HAY = hay;
export const INTERACTION = interaction;
export const DOG = dog;
export const CHAINLINK_AGGREGATOR = aggregator;
export const SPOT = spot;
export const TOKENS = tokenInfos;

export default {
  WEBSOCKET_URL,
  RPC_URL,
  PRIVATE_KEY,
  API,
  VAT,
  HAY,
  INTERACTION,
  DOG,
  CHAINLINK_AGGREGATOR,
  SPOT,
  TOKENS,
  START_AUCTION_INTERVAL,
  BUY_FROM_AUCTION_INTERVAL,
};
