const TriamSDK = require('triam-sdk');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const helmet = require('helmet');
const morgan = require('morgan');
const { parseOperations } = require('parse-tx-xdr-to-json-response');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet());
app.use(morgan('combined'));

const CONFIG = {
    MAIN_NET: {
        port: 9080,
        passPhrase: "SAAK5654--ARM-NETWORK--BHC3SQOHPO2GGI--BY-B.A.P--CNEMJQCWPTA--RUBY-AND-BLOCKCHAIN--3KECMPY5L7W--THANKYOU-CS--S542ZHDVHLFV",
        // Config the URLs of your's horizon server here
        horizonServer: "http://localhost:8000",
        minimumStartingBalance: '20'
    },
    TEST_NET: {
        port: 9080,
        passPhrase: "SAAK5654--ARM-NETWORK--BHC3SQOHPO2GGI--BY-B.A.P--CNEMJQCWPTA--RUBY-AND-BLOCKCHAIN--3KECMPY5L7W--THANKYOU-CS--S542ZHDVHLFV",
        horizonServer: "https://testnet-horizon.triamnetwork.com",
        minimumStartingBalance: '20'
    }
}

let triamConf = process.env.NODE_ENV == 'production' ? CONFIG.MAIN_NET : CONFIG.TEST_NET;

app.listen(triamConf.port, function () {
    console.log(`Server running on port ${triamConf.port} ${process.env.NODE_ENV || 'TESTNET'}`);
});

TriamSDK.Network.use(new TriamSDK.Network(triamConf.passPhrase));
const horizonServer = new TriamSDK.Server(triamConf.horizonServer, { allowHttp: true }); //connect to horizon server

//generating and new account with starting balance from another account
app.post('/generate-account', async function (req, res) {
    try{
        const { funderSecret, startingBalance } = req.body;
        if (!funderSecret) {
            return res.status(400).json({
                error: "bad request"
            })
        }
        const newRandomKeyPair = TriamSDK.Keypair.random();
        const operation = TriamSDK.Operation.createAccount({
            destination: newRandomKeyPair.publicKey(),
            startingBalance: startingBalance || triamConf.minimumStartingBalance
        });

        const result = await submitTransaction(operation, funderSecret, 'Test Create Account');

        if (result.success) {
            res.status(200).json({
                publicKey: newRandomKeyPair.publicKey(),
                secret: newRandomKeyPair.secret(),
            })
        } else {
            res.status(500).json({
                error: result.error
            })
        }
    }catch(err){
        res.status(500).json({
            error: err.message
        }) ;
    }
});

//Create new account with starting balance from another account
app.post('/create-account', async function (req, res) {
    try{
        const { funderSecret, startingBalance, destination } = req.body;
        if (!funderSecret || !destination) {
            return res.status(400).json({
                error: "bad request"
            })
        }
        const operation = TriamSDK.Operation.createAccount({
            destination,
            startingBalance: startingBalance || triamConf.minimumStartingBalance
        });

        const result = await submitTransaction(operation, funderSecret, 'Funding Account');

        if (result.success) {
            res.status(200).json({
                transactionHash: result.transaction.hash
            })
        } else {
            res.status(500).json({
                error: result.error
            })
        }
    }catch(err){
        res.status(500).json({
            error: err.message
        }) ;
    }
});

//Send coin/asset between accounts of system
app.post('/payment', async function (req, res) {
    /*
    * params:
    * assetCode: name of asset
    * issuerAddress(optional): wallet address of issuer, IF SENDING RIA COIN YOU DON'T NEED THIS PARAMS
    * destination: wallet to receive payment
    * secretKey: secret key of wallet send asset/coin
    * memo: maximum 28 character
    * */
   try{
        const params = req.body;
        if (!params.assetCode || !params.destination || !params.amount || !params.secretKey) {
            return res.status(400).json({
                error: "bad request"
            })
        }
        const asset = getAsset(params.assetCode, params.issuerAddress);

        if (!asset) res.status(500).json({
            error: "asset information is incorrect"
        });

        const operation = TriamSDK.Operation.payment({
            destination: params.destination,
            asset: asset,
            amount: String(params.amount)
        });

        const result = await submitTransaction(operation, params.secretKey, params.memo);

        if (result.success) {
            res.status(200).json({
                from: TriamSDK.Keypair.fromSecret(params.secretKey).publicKey(),
                to: params.destination,
                amount: params.amount,
                asset: params.assetCode,
                transactionHash: result.transaction.hash
            })
        } else {
            res.status(500).json({
                error: result.error
            })
        }
    } catch(err){
        res.status(500).json({
            error: err.message
        }) ;
    }
});
// API for balance inquiry
app.get('/balances/:address', async function (req, res) {
    /*
    * params:
    * address: wallet address to access info, native in balances is RIA coin
    */
    try {
        const result = await horizonServer.loadAccount(req.params.address);
        console.log("------ get account info ---------");
        console.log(result);
        console.log("------------------------------------------");
        res.status(200).json(result.balances);
    } catch (err) {
        console.log("Not found wallet");
        res.status(400).json({ error: "Not found wallet" });
    }
});

// API for inquiring current block height
app.get('/latest_ledger', async function (req, res) {
    request.get(triamConf.horizonServer, function (error, response, body) {
        if (error) res.status(500).json({ error });
        const { core_latest_ledger, history_latest_ledger } = JSON.parse(body);
        res.status(200).json({ core_latest_ledger });
    })
});

//API inquiring the transactions history of an account
app.get('/account-transaction/:address', async function (req, res) {
    /*
    * query:
    * limit(optional): max is 200, default is 20
    * cursor(optional): paging token of transaction, default is empty
    * order(optional): 'desc' or 'asc', default is desc
    * with_operations(optional): true/false , get detail transactions, default is false
    * */
    try {
        const { params, query } = req;
        let order = query.order ? query.order : 'desc';
        let limit = query.limit > 0 ? query.limit : 20;
        let cursor = query.cursor ? query.cursor : '';

        if (!params.address) {
            res.status(404).json({ error: "Not found wallet" });
        }

        horizonServer.transactions()
            .forAccount(params.address)
            .limit(limit)
            .cursor(cursor)
            .order(order)
            .call()
            .then(function (result) {
                if (query.with_operations) {
                    result = result.records.map(record => {
                        record.operations = parseOperations({
                            txEnvelopeXdr: record.envelope_xdr
                        });
                        return record;
                    });
                }
                res.status(200).json(result);
            })
            .catch(function (err) {
                res.status(400).json({ error: "Not found wallet" });
            })
    } catch (err) {
        console.log("Not found wallet");
        res.status(400).json({ error: "Not found wallet" });
    }
});

//API inquiring the transactions history in blockchain
app.get('/transactions', async function (req, res) {
    /*
    * query:
    * limit(optional): max is 200, default is 20
    * cursor(optional): paging token of transaction, default is empty
    * order(optional): 'desc' or 'asc', default is desc
    * with_operations(optional): true/false , get detail transactions, default is false
    * */
    try {
        const { query } = req;
        let order = query.order ? query.order : 'desc';
        let limit = query.limit > 0 ? query.limit : 20;
        let cursor = query.cursor ? query.cursor : '';

        horizonServer.transactions()
            .limit(limit)
            .cursor(cursor)
            .order(order)
            .call()
            .then(function (result) {
                if (query.with_operations) {
                    result = result.records.map(record => {
                        record.operations = parseOperations({
                            txEnvelopeXdr: record.envelope_xdr
                        });
                        return record;
                    });
                }

                res.status(200).json(result);
            })
            .catch(function (err) {
                res.status(400).json({ error: "Not found wallet" });
            })
    } catch (err) {
        console.log("Not found wallet");
        res.status(400).json({ error: "Not found wallet" });
    }
});

app.post('/change-trust', async function (req, res) {    /*
    * params:
    * assetCode: name of asset
    * issuerAddress(optional): wallet address of issuer
    * secretKey: secret key
    * memo: maximum 28 bytes
    * limit: // Defaults to max int64. The limit for the asset to receive. If the limit is set to "0" it deletes the asset from the account.
    * */
   try{
    const params = req.body;
    const {
        assetCode,
        issuerAddress,
        secretKey,
        limit,
        memo
    } = params;

    if (!assetCode || !issuerAddress || !secretKey) {
        return res.status(400).json({  error: "bad request" })
    }
    if(limit != null && Number(limit) < 0){
        return res.status(400).json({  error: "bad request" })
    }
    const asset = getAsset(assetCode, issuerAddress);

    if (!asset) {
      res.status(500).json({
        error: "asset information is incorrect",
      });
    }
    const operation = TriamSDK.Operation.changeTrust({
        asset,
        limit
    });

    const result = await submitTransaction(operation, secretKey, memo);

    if (result.success) {
        res.status(200).json({
            isTrusted: limit != 0,
            from: TriamSDK.Keypair.fromSecret(params.secretKey).publicKey(),
            asset: {
                code: assetCode,
                issuer: issuerAddress
            },
            transactionHash: result.transaction.hash
        })
    } else {
        res.status(500).json({
            error: 'Submit transaction error',
            extras: result.error
        });
    }
   }catch(err){
    console.log("Change-trust ERR", err);
    res.status(500).json({ error: err.message });
   }
})


async function submitTransaction(operation, key, memoText) {
    let fullKey = TriamSDK.Keypair.fromSecret(key);
    return new Promise((resolve) => {
        horizonServer.loadAccount(fullKey.publicKey())
            .then(function (account) {
                let transaction = new TriamSDK.TransactionBuilder(account, { fee: 10000 });
                transaction.addOperation(operation);
                if (memoText) {
                    let memo = new TriamSDK.Memo.text(memoText);
                    transaction.addMemo(memo);
                }

                transaction = transaction.build();

                transaction.sign(fullKey);

                return horizonServer.submitTransaction(transaction); //then submit this transaction to horizon server
            })
            .then(transaction => {
                console.log("-----Create transaction success-----");
                console.log(memoText);
                console.log("------------------------------------");
                console.log("Data return from horizon server:", transaction);
                resolve({ success: true, transaction: transaction });
            })
            .catch(err => {
                console.log("submitTransaction Error:");
                console.log(err);
                resolve({ success: false, error: err.message });
            });
    });
};

const getAsset = function (assetCode, issuerAddress) {
    if (assetCode === 'RIA') {
        return TriamSDK.Asset.native();
    }
    else {
        if (!issuerAddress || !assetCode) return null;
        return new TriamSDK.Asset(assetCode, issuerAddress);
    }
};
