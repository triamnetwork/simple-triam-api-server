# Triam nodejs server

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/ff0ea53cfbb17c3d7633)

## TESTNET

### Create a test account

Friendbot will fund an account with 10,000 RIA on the test network.

https://laboratory.triamnetwork.com/#account-creator?network=test

### Example test account
```
publicKey: GB6WUIHWTUQSZDYKHFWGR6VN5Y34FRU55FUB6WJI2UVPCSBLDSO3WGBX
secretKey: SBWVVLSZALXUKR5TBVXQ5XATZGT3SGZPP33ZAUHGB3CAG2VED6GQTB52
```

### Start server on testnet

```
npm install
npm start
```

## MAINNET

### Config your horizon url

```javascript
const CONFIG = {
    MAIN_NET: {
        ...
        // Config the URLs of your's horizon server here
        horizonServer: "http://localhost:8000",
        ...
    },
    TESTNET: {
     ...

 ```

### Start server on mainnet

```bash
npm install
pm2 start npm --name "Triam API Server" -- run start:prod
```
