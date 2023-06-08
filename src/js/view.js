/* global bulmaToast */

import { getShortAddress } from "./utils.js";
import {userAddress, contractValues, connect, connectCached, disconnect,
    getDeals, getLoans, loadStorageData,
    cancelLoan, makeDeal, closeDeal, addLoan} from "./dao-venom.js";

const TOKEN_IMG_PATH = "/opd.money/img/tokens/";

const TOAST_ERR_CONNECT_WALLET = {message: "Connect your wallet", type: "is-danger"};
const TOAST_INF_COPIED = {message: "Copied to clipboard", type: "is-info"};

bulmaToast.setDefaults({
    duration: 5000,
    position: "bottom-left",
    dismissible: true,
    animate: {in: "zoomIn", out: "zoomOut"}
});

document.addEventListener('DOMContentLoaded', onLoad);
document.getElementById("btnMyDeals").addEventListener("click", () => showMyDeals());
document.getElementById("btnMyLoans").addEventListener("click", () => showMyLoans());
document.getElementById("btnLoans").addEventListener("click", () => showLoans());
document.getElementById("btnInfo").addEventListener("click", () => showInfo());
document.getElementById("btnConnect").addEventListener("click", () => doConnect(false));
document.getElementById("btnCopyAddress").addEventListener("click", () => doCopyAddress());
document.getElementById("btnDisconnect").addEventListener("click", () => doDisconnect());

document.getElementById("tblMyDeals").addEventListener("click", () => showDeal());
document.getElementById("tblMyLoans").addEventListener("click", () => showLoan('cancelLoan'));
document.getElementById("tblLoans").addEventListener("click", () => showLoan('makeDeal'));

document.getElementById("btnNewMyLoan").addEventListener("click", () => doNewMyLoan());

document.getElementById("mmlLoanToken").addEventListener("change", () => doChangeToken('loan'));
document.getElementById("mmlDepositToken").addEventListener("change", () => doChangeToken('deposit'));

document.querySelectorAll('.js-calc-apr').forEach(function(item) {
    item.onchange = doCalcAPR;
});

document.getElementById("mmlLoanTokenAddress").addEventListener("click", () => doCopyAddress(event.currentTarget));
document.getElementById("mmlDepositTokenAddress").addEventListener("click", () => doCopyAddress(event.currentTarget));
document.getElementById("mmlButton").addEventListener("click", () => doAddLoan());

document.querySelectorAll('.js-faq-item').forEach(function(item) {
    item.onclick = doFAQ;
});


async function onLoad() {
    await doConnect(true);
    await loadStorageData();
    showLoans();
}


function showInfo() {
    hideBurgerMenu();
    hideContentPannels();
    document.getElementById("contentInfo").classList.remove("is-hidden");
    
}


function doFAQ() {
    let icon = event.currentTarget.querySelector(".fas");
    let acc = event.currentTarget.parentElement.querySelector(".is-collapsible");
    acc.classList.toggle("is-active");
    icon.classList.toggle("fa-angle-down");
    icon.classList.toggle("fa-angle-up");
};



/* =======================================================
                        Menu
======================================================= */
async function doConnect(isCachedOnly) {
    if (isCachedOnly) {
        await connectCached();
    } else {
        await connect();
    }
    if (userAddress) {
        document.getElementById("divConnect").classList.add("is-hidden");
        document.getElementById("aAddress").innerHTML = getShortAddress(userAddress);
        document.getElementById("divDisconnect").classList.remove("is-hidden");
        document.getElementById("btnNewMyLoan").removeAttribute("disabled");
   }
}

async function doDisconnect() {
    await disconnect();
    if (!userAddress) {
        document.getElementById("divDisconnect").classList.add("is-hidden");
        document.getElementById("aAddress").innerHTML = "";
        document.getElementById("divConnect").classList.remove("is-hidden");
        document.getElementById("btnNewMyLoan").setAttribute("disabled", "");
        showLoans();
    }
}

function doCopyAddress(el) {
    if (el) {
        let address = el.innerHTML;
        if (address && address.length > 10) {
            copyToClipboard(address);
        }
    } else if (userAddress) {
        copyToClipboard(userAddress);
   }    
}



/* =======================================================
                        My Deals
======================================================= */
async function showMyDeals() {
    hideBurgerMenu();
    hideContentPannels();
    let elTabel = document.getElementById("tblMyDeals");
    elTabel.innerHTML = "";
    document.getElementById("contentMyDeals").classList.remove("is-hidden");
    let dataTable = new Map();
    contractValues.set("dataTable", dataTable);
    if (!userAddress) {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
        return;
    }
    let data = await getDeals();
    if (data && data.length > 0) {
        let tokens = contractValues.get("tokens");
        let loan_token, deposit_token;
        let temp = "", key, value, isB, isC, days, enabled;
        for (let i = 0; i < data.length; i++) {
            key = data[i].key;
            value = data[i].value;
            loan_token = tokens.get(value.loan_token_id);
            deposit_token = tokens.get(value.deposit_token_id);
            isB = value.borrower === userAddress;
            isC = value.creditor === userAddress;
            days = Math.ceil((Date.parse(value.exp) - Date.now()) / (1000*60*60*24));
            enabled = isB || (isC && (days <= 0));
            if (isB || isC) {
                dataTable.set(key, value);
                temp += "<tr id=\"mydeal" + key + "\" data-id=\"" + key + "\" class=\"is-clickable" + (days < 0 ? " has-background-danger-light" : "") + "\">" +
                    "<td class=\"is-clickable\"><span class=\"icon\"><i class=\"fas fa-hand-holding-dollar\"" +
                        (isC ? " style=\"transform: rotate(180deg)" : "") + "\"></i></span></td>" +
                    "<td>" +
                        "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + loan_token.name + ".png\"></figure>" +
                        "<span class=\"has-text-weight-semibold\">" + loan_token.name + "</span>" +
                    "</td>" +
                    "<td>" + showTableValue(value.loan_amount, loan_token) + "</td>" +
                    "<td>" + showTableValue(value.reward, loan_token) + "</td>" +
                    "<td>" + days + (days === 1 ? " day" : " days") + "</td>" +
                    "<td>" +
                        "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + deposit_token.name + ".png\"></figure>" +
                        "<span class=\"has-text-weight-semibold\">" + deposit_token.name + "</span>&nbsp;" + showTableValue(value.deposit_amount, deposit_token) +
                    "</td>" +
                    //"<td class=\"has-text-link\"><span class=\"icon\"><i class=\"fas fa-angles-right\"></i></span></td>" +
                    "</tr>";
            }
        }
        elTabel.innerHTML = temp;
    }
}

async function showDeal() {
    let elTR = event.target.closest("tr");
    if (!elTR) {
        console.log("ERROR showDeal(): there is no TR element");
        return;
    }
    let id = elTR.getAttribute("data-id");
    console.log("INFO showDeal(): id=" + id);
    let data = contractValues.get("dataTable");
    if (id && data) {
        let value = data.get(id);
        if (value) {
            let loan_token = contractValues.get("tokens").get(value.loan_token_id);
            let deposit_token = contractValues.get("tokens").get(value.deposit_token_id);
            let isB = value.borrower === userAddress;
            let days = (Date.parse(value.exp) - Date.now()) / (1000*60*60*24);
            document.getElementById("mdLoanTokenImg").setAttribute("src", TOKEN_IMG_PATH + loan_token.name + ".png");
            document.getElementById("mdLoanTokenName").innerHTML = loan_token.name;
            document.getElementById("mdLoanAmount").innerHTML = showValue(value.loan_amount, loan_token);
            document.getElementById("mdRewardTokenImg").setAttribute("src", TOKEN_IMG_PATH + loan_token.name + ".png");
            document.getElementById("mdRewardTokenName").innerHTML = loan_token.name;
            document.getElementById("mdRewardAmount").innerHTML = showValue(value.reward, loan_token);
            let mdTime = document.getElementById("mdTime");
            mdTime.innerHTML = Math.ceil(days) + "&nbsp;" + (Math.abs(Math.ceil(days)) === 1 ? "day" : "days");
            if (days < 0) {
                mdTime.classList.add("has-text-danger");
            } else {
                mdTime.classList.remove("has-text-danger");
            }
            document.getElementById("mdDepositTokenImg").setAttribute("src", TOKEN_IMG_PATH + deposit_token.name + ".png");
            document.getElementById("mdDepositTokenName").innerHTML = deposit_token.name;
            document.getElementById("mdDepositAmount").innerHTML = showValue(value.deposit_amount, deposit_token);

            let mdTitle = document.getElementById("mdTitle");
            let mdButton = document.getElementById("mdButton");
            mdButton.setAttribute("data-id", id);
            mdButton.removeEventListener("click", doDeal);
            mdButton.classList.remove("is-loading");
            mdButton.removeAttribute("disabled");
            
            if (isB) {
                document.getElementById("mdSumTokenImg").setAttribute("src", TOKEN_IMG_PATH + loan_token.name + ".png");
                document.getElementById("mdSumTokenName").innerHTML = loan_token.name;
                document.getElementById("mdSumAmount").innerHTML = showValue((Number(value.loan_amount) + Number(value.reward)), loan_token);
                mdTitle.innerHTML = "Repay";
                mdButton.innerHTML = "Repay";
                mdButton.addEventListener("click", doDeal);
            } else {
                document.getElementById("mdSumTokenImg").setAttribute("src", TOKEN_IMG_PATH + deposit_token.name + ".png");
                document.getElementById("mdSumTokenName").innerHTML = deposit_token.name;
                document.getElementById("mdSumAmount").innerHTML = showValue(Number(value.deposit_amount), deposit_token);
                mdTitle.innerHTML = "Withdrawal";
                mdButton.innerHTML = "Take it";
                if (days <= 0) {
                    mdButton.addEventListener("click", doDeal);
                } else {
                    mdButton.setAttribute("disabled", "");
                }
            }
            document.getElementById("modalDeal").classList.add("is-active");
        } else {
            console.log("ERROR showDeal(): there is no deal value for id=" + id);
        }
    } else {
        console.log("ERROR showDeal(): there is no deal id or data");
    }
}

async function doDeal() {
    let btn = document.getElementById("mdButton");
    btn.classList.add("is-loading");
    let id = btn.getAttribute("data-id");
    console.log("INFO doDeal(): id=" + id);
    let data = contractValues.get("dataTable");
    if (id && data) {
        let value = data.get(id);
        if (value) {
            let txHash = await closeDeal(id, value.borrower, value.loan_token_id, (Number(value.loan_amount) + Number(value.reward)));
            if (txHash) {
                showToastNewTx(txHash);
                document.getElementById("mydeal" + id).remove();
            }
        } else {
            console.log("ERROR doDeal(): there is no deal value for id=" + id);
        }
    } else {
        console.log("ERROR doDeal(): there is no deal id or data");
    }
    document.getElementById("modalDeal").classList.remove("is-active");
    btn.classList.remove("is-loading");
}



/* =======================================================
                        My Loans
======================================================= */
async function showMyLoans() {
    hideBurgerMenu();
    hideContentPannels();
    let elTabel = document.getElementById("tblMyLoans");
    elTabel.innerHTML = "";
    document.getElementById("contentMyLoans").classList.remove("is-hidden");
    let dataTable = new Map();
    contractValues.set("dataTable", dataTable);
    if (!userAddress) {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
        return;
    }
    let data = await getLoans(userAddress, true);
    if (data && data.length > 0) {
        let tokens = contractValues.get("tokens");
        let temp = "", key, value, loan_token, deposit_token, days;
        for (let i = 0; i < data.length; i++) {
            key = data[i].key;
            value = data[i].value;
            loan_token = tokens.get(value.loan_token_id);
            deposit_token = tokens.get(value.deposit_token_id);
            days =  Math.ceil(value.time / (60*60*24));
            dataTable.set(key, value);
            temp += "<tr id=\"myloan" + key + "\" data-id=\"" + key + "\" class=\"is-clickable\">" +
                "<td>" +
                    "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + loan_token.name + ".png\"></figure>" +
                    "<span class=\"has-text-weight-semibold\">" + loan_token.name + "</span>" +
                "</td>" +
                "<td>" + showTableValue(value.loan_amount, loan_token) + "</td>" +
                "<td>" + showTableValue(value.reward, loan_token) + "</td>" +
                "<td>" + days + (days === 1 ? " day" : " days") + "</td>" +
                "<td>" +
                    "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + deposit_token.name + ".png\"></figure>" +
                    "<span class=\"has-text-weight-semibold\">" + deposit_token.name + "</span>&nbsp;" + showTableValue(value.deposit_amount, deposit_token) +
                "</td>" +
                "<td>" + showValidity(value.validity) + "</td>" +
                //"<td class=\"has-text-link\"><span class=\"icon\"><i class=\"fa-solid fa-xmark\"></i></span></td>" +
                "</tr>";
        }
        elTabel.innerHTML = temp;
    }
}

async function doNewMyLoan() {
    if (userAddress) {
        let tokens = contractValues.get("tokens");
        let temp = "<option value=\"\" selected=\"\">[select token]</option>";
        if (tokens) {
            for (let k of tokens.keys()) {
                if (tokens.get(k).active) {
                    temp += "<option value=\"" + k + "\">" + tokens.get(k).name + "</option>";
                }
            }
        }
        document.getElementById("mmlLoanToken").innerHTML = temp;
        document.getElementById("mmlDepositToken").innerHTML = temp;
        
        document.getElementById("mmlLoanTokenImage").setAttribute("src", "");
        document.getElementById("mmlRewardTokenImage").setAttribute("src", "");
        document.getElementById("mmlLoanTokenAddress").innerHTML = "&nbsp;";
        document.getElementById("mmlLoanAmount").value = "";
        document.getElementById("mmlRewardAmount").value = "";
        document.getElementById("mmlAPR").innerHTML = "-";
        document.getElementById("mmlDepositTokenImage").setAttribute("src", "");
        document.getElementById("mmlDepositTokenAddress").innerHTML = "&nbsp;";
        document.getElementById("mmlDepositAmount").value = "";
        document.getElementById("mmlValidity").value = "";

        document.getElementById("mmlButton").classList.remove("is-loading");
        document.getElementById('modalMyLoan').classList.add('is-active');
    } else {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
    }
}

function doChangeToken(target) {
    let tokens = contractValues.get("tokens");
    if (target === "loan") {
        let v = document.getElementById("mmlLoanToken").value;
        if (v && v >= 0) {
            document.getElementById("mmlLoanTokenImage").setAttribute("src", TOKEN_IMG_PATH + tokens.get(v).name + ".png");
            document.getElementById("mmlRewardTokenImage").setAttribute("src", TOKEN_IMG_PATH + tokens.get(v).name + ".png");
            document.getElementById("mmlLoanTokenAddress").innerHTML = getShortAddress(tokens.get(v).address);
        } else {
            document.getElementById("mmlLoanTokenImage").setAttribute("src", "");
            document.getElementById("mmlRewardTokenImage").setAttribute("src", "");
            document.getElementById("mmlLoanTokenAddress").innerHTML = "&nbsp;";
        }
    } else if (target === "deposit") {
        let v = document.getElementById("mmlDepositToken").value;
        if (v && v >= 0) {
            document.getElementById("mmlDepositTokenImage").setAttribute("src", TOKEN_IMG_PATH + tokens.get(v).name + ".png");
            document.getElementById("mmlDepositTokenAddress").innerHTML = getShortAddress(tokens.get(v).address);
        } else {
            document.getElementById("mmlDepositTokenImage").setAttribute("src", "");
            document.getElementById("mmlDepositTokenAddress").innerHTML = "&nbsp;";
        }
    }
}

function doCalcAPR() {
    let loanAmount = document.getElementById("mmlLoanAmount").value;
    let rewardAmount = document.getElementById("mmlRewardAmount").value;
    let time = document.getElementById("mmlTime").value;

    if (!isNaN(loanAmount) && !isNaN(parseFloat(loanAmount)) &&
            !isNaN(rewardAmount) && !isNaN(parseFloat(rewardAmount)) &&
            !isNaN(time) && !isNaN(parseFloat(time))) {
        document.getElementById("mmlAPR").innerHTML = (rewardAmount * 100 * 365 / time / loanAmount).toFixed(2);
    } else {
        document.getElementById("mmlAPR").innerHTML = "-";
    }
}

async function doAddLoan() {
    let btn = document.getElementById("mmlButton");
    btn.classList.add("is-loading");

    let loanTokenId = document.getElementById("mmlLoanToken").value;
    let loanAmount = document.getElementById("mmlLoanAmount").value;
    let rewardAmount = document.getElementById("mmlRewardAmount").value;
    let time = document.getElementById("mmlTime").value;
    let depositTokenId = document.getElementById("mmlDepositToken").value;
    let depositAmount = document.getElementById("mmlDepositAmount").value;
    let validity = document.getElementById("mmlValidity").value;

    let tokens = contractValues.get("tokens");
    let isError = false;
    if (!tokens || !tokens.get(loanTokenId)) {
        console.log("ERROR doAddLoan(): loan token has to be selected");
        bulmaToast.toast({message: "Select <b>loan asset</b>", type: "is-danger"});
        isError = true;
    }
    if (!(loanAmount && loanAmount > 0)) {
        console.log("ERROR doAddLoan(): loan amount has to be a number in (0, inf)");
        bulmaToast.toast({message: "Enter <b>loan amount</b> in (0, inf)", type: "is-danger"});
        isError = true;
    }
    if (!(rewardAmount && rewardAmount >= 0)) {
        console.log("ERROR doAddLoan(): reward amount has to be a number in [0, inf)");
        bulmaToast.toast({message: "Enter <b>reward amount</b> in [0, inf)", type: "is-danger"});
        isError = true;
    }
    let DAY = 60*60*24;
    time = Math.floor(time * DAY);
    if (time && (time >= contractValues.get("time").min) && (time <= contractValues.get("time").max)) {
    } else {
        console.log("ERROR doAddLoan(): time has to be in [" + contractValues.get("time").min/DAY + ", " + contractValues.get("time").max/DAY + "] days");
        bulmaToast.toast({message: "Loan term has to be in [" + contractValues.get("time").min/DAY + ", " + contractValues.get("time").max/DAY + "] days",type: "is-danger"});
        isError = true;
    }
    if (!tokens.get(depositTokenId)) {
        console.log("ERROR doAddLoan(): deposit token has to be selected");
        bulmaToast.toast({message: "Select <b>collateral asset</b>", type: "is-danger"});
        isError = true;
    }
    if (loanTokenId && loanTokenId === depositTokenId) {
        console.log("ERROR doAddLoan(): loan and deposit tokens have to be different");
        bulmaToast.toast({message: "<b>Loan</b> and <b>collateral assets</b> have to be different", type: "is-danger"});
        isError = true;
    }
    if (!(depositAmount && depositAmount >= 0)) {
        console.log("ERROR doAddLoan(): deposit amount has to be a number in [0, inf)");
        bulmaToast.toast({message: "Enter <b>collateral amount</b> in [0, inf)", type: "is-danger"});
        isError = true;
    }
    if (validity) {
        if (Math.floor(new Date(validity).getTime() / 60000) <= Math.floor(Date.now() / 60000)) {
            console.log("ERROR doAddLoan(): validity has to be later than the current moment");
            bulmaToast.toast({message: "<b>Validity</b> has to be later than the current moment", type: "is-danger"});
            isError = true;
        }
    }    
    
    if (!isError && userAddress) {
        let txHash = await addLoan(loanTokenId, loanAmount, rewardAmount, time, depositTokenId, depositAmount, validity);
        if (txHash) {
            showToastNewTx(txHash);
            document.getElementById("modalMyLoan").classList.remove("is-active");
        }
    }
    btn.classList.remove("is-loading");

}



/* =======================================================
                        Loans
======================================================= */
async function showLoans() {
    hideBurgerMenu();
    hideContentPannels();
    document.getElementById("contentLoans").classList.remove("is-hidden");
    let elTabel = document.getElementById("tblLoans");
    elTabel.innerHTML = "";
    let dataTable = new Map();
    contractValues.set("dataTable", dataTable);
    if (!userAddress) {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
        return;
    }
    let data = await getLoans(userAddress, false);
    if (data && data.length > 0) {
        let tokens = contractValues.get("tokens");
        let temp = "", key, value, loan_token, deposit_token, days;
        for (let i = 0; i < data.length; i++) {
            key = data[i].key;
            value = data[i].value;
            if (value.borrower !== userAddress) {
                loan_token = tokens.get(value.loan_token_id);
                deposit_token = tokens.get(value.deposit_token_id);
                days = Math.ceil(value.time / (60*60*24));
                dataTable.set(key, value);
                temp += "<tr id=\"loan" + key + "\" data-id=\"" + key + "\" class=\"is-clickable\">" +
                    "<td>" +
                        "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + loan_token.name + ".png\"></figure>" +
                        "<span class=\"has-text-weight-semibold\">" + loan_token.name + "</span>" +
                    "</td>" +
                    "<td>" + showTableValue(value.loan_amount, loan_token) + "</td>" +
                    "<td>" + showTableValue(value.reward, loan_token) + "</td>" +
                    "<td>" + days + (days === 1 ? " day" : " days") + "</td>" +
                    "<td>" +
                        "<figure class=\"image is-24x24 mr-1 is-pulled-left\"><img src=\"" + TOKEN_IMG_PATH + deposit_token.name + ".png\"></figure>" +
                        "<span class=\"has-text-weight-semibold\">" + deposit_token.name + "</span>&nbsp;" + showTableValue(value.deposit_amount, deposit_token) +
                    "</td>" +
                    //"<td class=\"has-text-link\"><span class=\"icon\"><i class=\"fas fa-angles-right\"></i></span></td>" +
                    "</tr>";
            }
        };
        elTabel.innerHTML = temp;
    }
}

async function showLoan(action) {
    if (!userAddress) {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
        return;
    }
    let elTR = event.target.closest("tr");
    if (!elTR) {
        console.log("ERROR showLoan(): there is no TR element");
        return;
    }
    let id = elTR.getAttribute("data-id");
    console.log("INFO showLoan(): id=" + id);
    console.log("INFO showLoan(): action=" + action);
    if (action === "cancelLoan" || action === "makeDeal") {
    } else {
        console.log("ERROR showLoan(): invalid action");
        return;
    }
    let data = contractValues.get("dataTable");
    if (id && data) {
        let value = data.get(id);
        if (value) {
            let loan_token = contractValues.get("tokens").get(value.loan_token_id);
            let deposit_token = contractValues.get("tokens").get(value.deposit_token_id);
            let days = Math.ceil(value.time / (60*60*24));
            document.getElementById("mlLoanTokenImg").setAttribute("src", TOKEN_IMG_PATH + loan_token.name + ".png");
            document.getElementById("mlLoanTokenName").innerHTML = loan_token.name;
            document.getElementById("mlLoanAmount").innerHTML = showValue(value.loan_amount, loan_token);
            document.getElementById("mlRewardTokenImg").setAttribute("src", TOKEN_IMG_PATH + loan_token.name + ".png");
            document.getElementById("mlRewardTokenName").innerHTML = loan_token.name;
            document.getElementById("mlRewardAmount").innerHTML = showValue(value.reward, loan_token);
            document.getElementById("mlTime").innerHTML = days + "&nbsp;" + (days === 1 ? "day" : "days");
            document.getElementById("mlValidity").innerHTML = showValidity(value.validity);
            document.getElementById("mlDepositTokenImg").setAttribute("src", TOKEN_IMG_PATH + deposit_token.name + ".png");
            document.getElementById("mlDepositTokenName").innerHTML = deposit_token.name;
            document.getElementById("mlDepositAmount").innerHTML = showValue(value.deposit_amount, deposit_token);

            let mlTitle = document.getElementById("mlTitle");
            let mlButton = document.getElementById("mlButton");
            mlButton.setAttribute("data-id", id);
            mlButton.removeEventListener("click", doCancelLoan);
            mlButton.removeEventListener("click", doMakeDeal);
            mlButton.classList.remove("is-loading");
            mlButton.removeAttribute("disabled");
            if (action === "cancelLoan") {
                mlTitle.innerHTML = "My loan request";
                mlButton.innerHTML = "Cancel request";
                mlButton.addEventListener("click", doCancelLoan);
            } else if (action === "makeDeal") {
                mlTitle.innerHTML = "Loan request";
                mlButton.innerHTML = "Lend";
                if (userAddress === value.borrower) {
                    mlButton.setAttribute("disabled", "");
                } else {
                    mlButton.addEventListener("click", doMakeDeal);
                }
            }
            document.getElementById("modalLoan").classList.add("is-active");
        } else {
            console.log("ERROR showLoan(): there is no loan value for id=" + id);
        }
    } else {
        console.log("ERROR showLoan(): there is no loan id or data for action=" + action);
    }
}

async function doCancelLoan() {
    let btn = document.getElementById("mlButton");
    let id = btn.getAttribute("data-id");
    console.log("INFO doCancelLoan(): id=" + id);
    if (id) {
        btn.classList.add("is-loading");
        let txHash = await cancelLoan(id);
        if (txHash) {
            showToastNewTx(txHash);
            document.getElementById("myloan" + id).remove();
        }
    } else {
        console.log("ERROR doCancelLoan(): there is no loan id");
    }
    document.getElementById("modalLoan").classList.remove("is-active");
    btn.classList.remove("is-loading");
}

async function doMakeDeal() {
    if (!userAddress) {
        bulmaToast.toast(TOAST_ERR_CONNECT_WALLET);
        return;
    }
    let btn = document.getElementById("mlButton");
    btn.classList.add("is-loading");
    let id = btn.getAttribute("data-id");
    console.log("INFO doMakeDeal(): id=" + id);
    let data = contractValues.get("dataTable");
    if (id && data) {
        let value = data.get(id);
        if (value) {
            let txHash = await makeDeal(id, value.loan_token_id, value.loan_amount);
            if (txHash) {
                showToastNewTx(txHash);
                document.getElementById("loan" + id).remove();
            }
        } else {
            console.log("ERROR doMakeDeal(): there is no loan value for id=" + id);
        }
    } else {
        console.log("ERROR doMakeDeal(): there is no loan id or data");
    }
    document.getElementById("modalLoan").classList.remove("is-active");
    btn.classList.remove("is-loading");
}



/* =======================================================
                        Utils
======================================================= */
function showValidity(validity) {
    if (validity) {
        return new Date(Date.parse(validity)).toLocaleString();
    }
    return "&infin;";
}

function showValue(value, token) {
    if (token) {
        return value / 10 ** token.decimals;
    } 
    return value;
}

function showTableValue(value, token) {
    let DEC = 4;
    if (token) {
        let r = Math.round(value / 10 ** (token.decimals - DEC));
        return r / 10 ** DEC;
    } 
    return value;
}

function showToastNewTx(txHash) {
    bulmaToast.toast({
        //message: "Your request is processing with ID " + txHash,
        message: "Your request is processing",
        duration: 5000,
        type: "is-info"
    });
}

function hideBurgerMenu() {
    document.getElementById("btnBurger").classList.remove("is-active");
    document.getElementById("navbarMenu").classList.remove("is-active");
}

function hideContentPannels() {
    document.getElementById("contentMyDeals").classList.add("is-hidden");
    document.getElementById("contentMyLoans").classList.add("is-hidden");
    document.getElementById("contentLoans").classList.add("is-hidden");
    document.getElementById("contentInfo").classList.add("is-hidden");
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {}, function(error) {
            console.log("ERROR copyToClipboard(): " + error);
        });
        bulmaToast.toast(TOAST_INF_COPIED);
        return;
    }
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
        bulmaToast.toast(TOAST_INF_COPIED);
    } catch (error) {
        console.log("ERROR copyToClipboard(): " + error);
    }
    document.body.removeChild(textArea);
}
