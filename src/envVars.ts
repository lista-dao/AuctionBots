import "dotenv/config";

const privateKey = process.env.PRIVATE_KEY;
const websocketUrl = process.env.WEBSOCKET_URL;
let startAuctionInterval = process.env.START_AUCTION_INTERVAL;
let buyFromAuctionInterval = process.env.BUY_FROM_AUCTION_INTERVAL;

if (!privateKey) {
  throw new Error("private key does not provided");
}

if (!websocketUrl) {
  throw new Error("websocket url does not provided");
}

if (!startAuctionInterval) {
  startAuctionInterval = "86400000";
}

if (!buyFromAuctionInterval) {
  buyFromAuctionInterval = "3000";
}

export const WEBSOCKET_URL = websocketUrl;
export const PRIVATE_KEY = privateKey;
export const START_AUCTION_INTERVAL = parseInt(startAuctionInterval);
export const BUY_FROM_AUCTION_INTERVAL = parseInt(buyFromAuctionInterval);

export default {
  WEBSOCKET_URL,
  PRIVATE_KEY,
  START_AUCTION_INTERVAL,
  BUY_FROM_AUCTION_INTERVAL,
};
