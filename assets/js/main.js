const CONTRACT_ADDRESS = "0x14E8b19361560DbE65f1d6C8679AAA453e566836";
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const evmChains = window.evmChains;

let web3Modal
let provider;
let selectedAccount;

var contract_stat = {
    total_airdropped: 0,
    total_airdropped_users: 0,
}

var user = {
    is_connected: false,
    balance: 0,
    unstake_time: 0,
    is_airdropped: null
}

const switchEthereumNetwork = (async () => {
    try {
        //Force switch to Bsc Mainnet
        await web3.currentProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{
                chainId: "0x38"
            }],
        });
    } catch (error) {
        if (error.code === 4902) {
            try {
                await web3.currentProvider.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x38",
                        chainName: "Smart Chain",
                        rpcUrls: ["https://bsc-dataseed.binance.org/"],
                        nativeCurrency: {
                            name: "Binance Smart Chain",
                            symbol: "BNB",
                            decimals: 18,
                        },
                        blockExplorerUrls: ["https://bscscan.com"],
                    }, ],
                });
            } catch (err) {
                alert(err.message);
            }
        }
    }
})();

// switchEthereumNetwork();


let abi = (function () {
    var json = null;
    $.ajax({
        'async': false,
        'global': false,
        'url': "abi/contract.json",
        'dataType': "json",
        'success': function (data) {
            json = data;
        }
    });
    return json;
})();


function reloadPage() {
    setTimeout(() => {
        window.location.reload();
    }, 9000);
}


async function getContractStat() {
    const web3 = new Web3(provider);
    const contract = new web3.eth.Contract(abi, CONTRACT_ADDRESS);
    const res = await contract.methods.getAirdropInfo().call();
    if (res) {
        contract_stat.total_airdropped_users = res[0];
        contract_stat.total_airdropped = res[1];

        if ($("#total_distributed").length) {
            $("#total_distributed").html(contract_stat.total_airdropped / 1e8 + '<span> distributed to</span> ' + contract_stat.total_airdropped_users);
        }
    } else {
        return 0;
    }
}

async function getUsersStat() {
    const is_bsc_chain = await fetchAccountData();
    if (!is_bsc_chain) return showErrorMessage("BSC Chain must be selected");
    const web3 = new Web3(provider);
    const contract = new web3.eth.Contract(abi, CONTRACT_ADDRESS);
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    const res = await contract.methods.users(account).call();
    if (res) {
        user.balance = res[0];
        user.unstake_time = res[1];
        user.is_airdropped = res[2];

        if (user.is_airdropped) {
            let unstake_exist = document.getElementById("unstake_time");
            if (unstake_exist) {
                var countDownDate = new Date(res[1] * 1000).getTime();
                setInterval(function () {

                    var now = new Date().getTime();
                    var distance = countDownDate - now;

                    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) /
                        (
                            1000 * 60 *
                            60));
                    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (
                        1000 *
                        60));
                    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    document.getElementById("unstake_time").innerHTML = days + 'D ' + hours + "H " + minutes + "M " + seconds + "S ";

                    if (distance < 0) {
                        $('.withdraw_airdrop').prop('disabled', false);
                        document.getElementById("unstake_time").innerHTML = "Unstake Now";
                    }
                }, 1000);
            }
            $(".balance").text(user.balance / 1e8);
        }

    } else {
        return 0;
    }
}


$(".get_airdrop").click(async function () {
    onConnect();
    const is_bsc_chain = await fetchAccountData();
    if (!is_bsc_chain) return showErrorMessage("BSC Chain must be selected");

    const web3 = new Web3(provider);
    const contract = new web3.eth.Contract(abi, CONTRACT_ADDRESS);
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    if(user.is_airdropped) return showErrorMessage("Already Claimed");

    const response = await contract.methods.getAirdrop(account).send({
        from: account
    });
    if (response) {
        showSuccess("Transaction Successfull")
        return response;
    } else {
        showErrorMessage("Something failed..");
    }
})


$(".withdraw_airdrop").click(async function () {
    const is_bsc_chain = await fetchAccountData();
    if (!is_bsc_chain) return showErrorMessage("BSC Chain must be selected");

    const web3 = new Web3(provider);
    const contract = new web3.eth.Contract(abi, CONTRACT_ADDRESS);
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];

    if(user.balance == 0) return showErrorMessage("Already Claimed");

    const response = await contract.methods.withdraw(account).send({
        from: account
    });
    if (response) {
        showSuccess("Transaction Successfull")
        return response;
    } else {
        showErrorMessage("Something failed..");
    }
})


setTimeout(async function () {
    if (provider != null && provider != undefined) {
        const web3 = new Web3(provider);
        const chainId = await web3.eth.getChainId();
        if (chainId == 56) {
            getUsersStat();
            getContractStat();
        }
    }
}, 2000)


function showErrorMessage(msg) {
    let notyf = new Notyf();
    notyf.error({
        message: msg,
        duration: 5000,
        position: {
            x: 'center',
            y: 'top',
        },
    });
}


function showSuccess(msg) {
    let notyf = new Notyf();
    notyf.success({
        message: msg,
        duration: 5000,
        position: {
            x: 'center',
            y: 'top',
        }
    });
}


function init() {

    if (location.protocol !== 'https:') {
        showErrorMessage("Only https allowed");
        const input = document.querySelector('.connect_wallet');
        if (input) {
            document.querySelector(".connect_wallet").setAttribute("disabled", "disabled")
        }
        return;
    }

    
    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider,
            options: {
                bridge: "https://bridge.walletconnect.org",
                rpc: {
                    56: "https://bsc-dataseed1.binance.org",
                },
                chainId: 56,
                network: "binance",
          
            },
        }
    };

    web3Modal = new Web3Modal({
        theme: "dark",
        network: "binance",
        cacheProvider: true,
        providerOptions, // required
        disableInjectedProvider: false
    });


    if (web3Modal.cachedProvider) {
        onConnect();
    }
}

async function fetchAccountData() {
    const web3 = new Web3(provider);
    const chainId = await web3.eth.getChainId();
    if (chainId == 56) {
        const accounts = await web3.eth.getAccounts();
        selectedAccount = accounts[0];

        $(".connect_wallet").hide();
        $('.withdraw_airdrop').prop('disabled', true);

        user.is_connected = true;

        return true;
    } else {
        showErrorMessage("BSC Chain must be selected");
    }
}

async function refreshAccountData() {
    await fetchAccountData();
}

async function onConnect() {

    try {
        provider = await web3Modal.connect();
    } catch (e) {
        return;
    }

    provider.on("accountsChanged", (accounts) => {
        fetchAccountData();
    });
    provider.on("chainChanged", (chainId) => {
        fetchAccountData();
    });
    provider.on("networkChanged", (networkId) => {
        fetchAccountData();
    });



    await refreshAccountData();
}

async function onDisconnect() {

    if (provider.close) {
        await provider.close();
        await web3Modal.clearCachedProvider();
        provider = null;
    }

    selectedAccount = null;
}

window.addEventListener('load', async () => {
    init();
    if ($(".connect_wallet").length) {
        document.querySelector(".connect_wallet").addEventListener("click", onConnect);
    }


});