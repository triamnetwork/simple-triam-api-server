# Triam nodejs server

[![Run in Postman](https://run.pstmn.io/button.svg)](https://www.getpostman.com/run-collection/a03b0dab263d5ff4075d)


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
        port: 9080,
        passPhrase: "SAAK5654--ARM-NETWORK--BHC3SQOHPO2GGI--BY-B.A.P--CNEMJQCWPTA--RUBY-AND-BLOCKCHAIN--3KECMPY5L7W--THANKYOU-CS--S542ZHDVHLFV",
        // Config the URLs of your's horizon server here
        horizonServer: "http://localhost:8000",
        minimumStartingBalance: '20'
    },
    TESTNET: {
     ...

 ```

### Start server on mainnet

```bash
npm install
pm2 start npm --name "Triam API Server" -- run start:prod
```
