import { getRealValue, jsonToMap } from "./utils.js";
import { Address, ProviderRpcClient } from "everscale-inpage-provider";
import { EverscaleStandaloneClient } from "everscale-standalone-client";
import { VenomConnect } from "venom-connect";
import SMARTCONTRACT_ABI from "../opd.abi.json";

//0:ea034e31cece017972f86c804980c7a536bda7880cb312d4e5ea76e500df6feb
const SMARTCONTRACT_ADDRESS = new Address("0:ea034e31cece017972f86c804980c7a536bda7880cb312d4e5ea76e500df6feb");
//0:4b11d71b5c4d5de896d8bc8ac4f6d7ee6653286425b54648e4307e75cea6ac28


const venomConnect = new VenomConnect({
    theme: "dark", // light
    checkNetworkId: 1002, // 1000 - venom testnet, 1 - venom mainnet
    providersOptions: {
        venomwallet: {
            links: {},
            walletWaysToConnect: [{
                package: ProviderRpcClient,
                packageOptions: {
                    fallback: VenomConnect.getPromise("venomwallet", "extension") || (() => Promise.reject()),
                    forceUseFallback: true
                },
                id: "extension",
                type: "extension"
            }],
            defaultWalletWaysToConnect: ["mobile", "ios", "android"]
        },
        everwallet: {
            links: {},
            walletWaysToConnect: [{
                package: ProviderRpcClient,
                packageOptions: {
                    fallback: VenomConnect.getPromise("everwallet", "extension") || (() => Promise.reject()),
                    forceUseFallback: true
                },
                id: "extension",
                type: "extension"
            }],
            defaultWalletWaysToConnect: ["mobile", "ios", "android"]
        }
    }
});


var provider;
var smartContract;
export let userAddress = "";
export let contractValues = new Map();


export async function connectCached() {
    provider = await venomConnect.checkAuth();
    if (provider) {
        let providerState = await provider.getProviderState();
        if (providerState) {
            try {
                userAddress = providerState.permissions.accountInteraction.address.toString();
                console.log("INFO connect(): old userAddress=" + userAddress);
                return true;
            } catch (error) {
            }
        }
    }
    return false;
}


export async function connect() {
    await connectCached();
    if (!userAddress) {
        try {
            venomConnect.on('extension-auth', async function (_provider) {
                provider = _provider;
                const providerState = await provider.getProviderState();
                console.log("INFO connect(): got providerState=", providerState);
                userAddress = providerState.permissions.accountInteraction.address.toString();;
                console.log("INFO connect(): new userAddress=" + userAddress);
                document.location.reload();
            });
            await venomConnect.connect();
        } catch (error) {
            console.log("ERROR connect(): " + JSON.stringify(error));
        }
    }
}


export async function disconnect() {
    if (provider) {
        provider.disconnect();
    }
    userAddress = "";
}


export async function getDeals() {
    try {
        let json = await smartContract.methods.deals().call();
        if (json) {
            let r = new Map(json.deals);
            let deals = new Array();
            for (let k of r.keys()) {
                let v = r.get(k);
                let deal = {
                    key: k,
                    value: {
                        borrower: v.borrower.toString(),
                        loan_token_id: v.loanTokenId,
                        loan_amount: v.loanAmount,
                        reward: v.reward,
                        creditor: v.creditor.toString(),
                        deposit_token_id: v.depositTokenId,
                        deposit_amount: v.depositAmount,
                        exp: new Date(Number.parseInt(v.exp) * 1000).toJSON()
                    }
                };
                deals.push(deal);
            }
            console.log("INFO getDeals(): deals.size=" + deals.length + ", deals=" + JSON.stringify(deals));
            return deals;
        } else {
            console.log("ERROR getDeals(): can't get deals");
        }
    } catch (error) {
        console.log("ERRROR getDeals(): " + JSON.stringify(error));
    }
}


export async function getLoans(address, isBorrower) {
    try {
        let json = await smartContract.methods.loans().call();
        if (json) {
            let r = new Map(json.loans);
            let loans = new Array();
            for (let k of r.keys()) {
                let v = r.get(k);
                let borrower = v.borrower.toString();
                if (!address || (address && ((isBorrower && address === borrower) || (!isBorrower && address !== borrower)))) {
                    let loan = {
                        key: k,
                        value: {
                            borrower: borrower,
                            loan_token_id: v.loanTokenId,
                            loan_amount: v.loanAmount,
                            reward: v.reward,
                            deposit_token_id: v.depositTokenId,
                            deposit_amount: v.depositAmount,
                            time: v.time,
                            validity: v.validity === "0" ? null : v.validity
                        }
                    };
                    loans.push(loan);
                }
            }
            console.log("INFO getLoans(): loans.size=" + loans.length + ", loans=" + JSON.stringify(loans));
            return loans;
        } else {
            console.log("ERROR getLoans(): can't get loans");
        }
    } catch (error) {
        console.log("ERRROR getLoans(): " + JSON.stringify(error));
    }
}


export async function loadStorageData() {
    if (!provider) {
        console.log("ERROR loadStorageData(): provider=" + provider);
        return;
    }
    if (!smartContract) {
        smartContract = new provider.Contract(SMARTCONTRACT_ABI, SMARTCONTRACT_ADDRESS);
        if (!smartContract) {
            console.log("ERROR loadStorageData(): smartContract=" + smartContract);
            return;
        }
    }

    try {
        let json = await smartContract.methods.getTime().call();
        if (json) {
            contractValues.set("time", json.value0);
            console.log("INFO loadStorageData(): time=" + JSON.stringify(json.value0));
        } else {
            console.log("ERROR loadStorageData(): can't get time");
        }
    } catch (error) {
        console.log("ERRROR loadStorageData() getting time: " + error + " " + JSON.stringify(error));
    }
    
    try {
        let json = await smartContract.methods.tokens().call();
        if (json) {
            let r = new Map(json.tokens);
            let tokens = new Map();
            for (let k of r.keys()) {
                let v = r.get(k);
                tokens.set(k, {
                    name: v.name,
                    address: v.tokenAddress.toString(),
                    type: v.tokenType,
                    token_id: v.tokenId,
                    decimals: v.decimals,
                    active: v.active,
                    locked_amount: v.lockedAmount
                });
            }
            contractValues.set("tokens", tokens);
            console.log("INFO loadStorageData(): tokens=" + JSON.stringify(json.tokens));
        } else {
            console.log("ERROR loadStorageData(): can't get tokens");
        }
    } catch (error) {
        console.log("ERRROR loadStorageData(): " + error);
    }
}


export async function cancelLoan(id) {
    try {
        const result = await smartContract.methods.cancelLoan({
            id: id
        }).send({
            amount: "10000000", //0.01 Venom
            bounce: true,
            from: userAddress
        }).catch((e) => {
            console.log("ERRROR cancelLoan(): e=" + e + " e=" + JSON.stringify(e));
        });

        if (result) {
            console.log("INFO cancelLoan(): result=" + JSON.stringify(result));
            return result;
        }
    } catch (error) {
        console.log("ERRROR cancelLoan(): " + error);
    }
}


export async function makeDeal(id, tokenId, amount) {
    let token = contractValues.get("tokens").get(tokenId);
    if (!token) {
        return null;
    }
    try {
        const result = await smartContract.methods.makeDeal({
            id: id
        }).send({
            amount: "10000000", //0.01 Venom
            bounce: true,
            from: userAddress
        }).catch((e) => {
            console.log("ERRROR makeDeal(): e=" + e + " e=" + JSON.stringify(e));
        });

        if (result) {
            console.log("INFO makeDeal(): result=" + JSON.stringify(result));
            return result;
        }
    } catch (error) {
        console.log("ERRROR makeDeal(): " + error);
    }
}


export async  function closeDeal(id, borrowerAddress, loanTokenId, amount) {
    let token = contractValues.get("tokens").get(loanTokenId);
    if (!token) {
        return null;
    }
    try {
        const result = await smartContract.methods.closeDeal({
            id: id
        }).send({
            amount: "10000000", //0.01 Venom
            bounce: true,
            from: userAddress
        }).catch((e) => {
            console.log("ERRROR closeDeal(): e=" + e + " e=" + JSON.stringify(e));
        });

        if (result) {
            console.log("INFO closeDeal(): result=" + JSON.stringify(result));
            return result;
        }
    } catch (error) {
        console.log("ERRROR closeDeal(): " + error);
    }   
}


export async  function addLoan(loanTokenId, loanAmount, rewardAmount, time, depositTokenId, depositAmount, validity) {
    let loanToken = contractValues.get("tokens").get(loanTokenId);
    let depositToken = contractValues.get("tokens").get(depositTokenId);
    loanAmount = getRealValue(loanAmount, loanToken.decimals);
    rewardAmount = getRealValue(rewardAmount, loanToken.decimals);
    depositAmount = getRealValue(depositAmount, depositToken.decimals);
    console.log("INFO addLoan() ---");
    console.log("loanToken.address=" + loanToken.address);
    console.log("loanToken.name=" + loanToken.name);
    console.log("loanToken.token_id=" + loanToken.token_id);
    console.log("loanToken.type=" + loanToken.type);
    console.log("loanAmount=" + loanAmount);
    console.log("rewardAmount=" + rewardAmount);
    console.log("time=" + time);
    console.log("depositToken.address=" + depositToken.address);
    console.log("depositToken.name=" + depositToken.name);
    console.log("depositToken.token_id=" + depositToken.token_id);
    console.log("depositToken.type=" + depositToken.type);
    console.log("depositAmount=" + depositAmount);
    console.log("validity=" + validity);
    console.log("INFO addLoan() ---");

    if ((time >= contractValues.get("time").min) && (time <= contractValues.get("time").max)) {
    } else {
        return;
    }
    
    if (validity) {
        if (Math.floor(new Date(validity).getTime() / 60000) <= Math.floor(Date.now() / 60000)) {
            return;
        }
    }
    
    try {
        const result = await smartContract.methods.addLoan({
            loanTokenId: loanTokenId,
            loanAmount: loanAmount,
            reward: rewardAmount,
            depositTokenId: depositTokenId,
            depositAmount: depositAmount,
            _time: time,
            validity: 0
        }).send({
            amount: "10000000", //0.01 Venom
            bounce: true,
            from: userAddress
        }).catch((e) => {
            console.log("ERRROR addLoan(): e=" + e + " e=" + JSON.stringify(e));
        });

        if (result) {
            console.log("INFO addLoan(): result=" + JSON.stringify(result));
            return result;
        }
    } catch (error) {
        console.log("ERRROR addLoan(): " + error);
    }   
}
