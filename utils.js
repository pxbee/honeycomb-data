const { rpcEndpoints, ERC20Abi } = require('./constants.js');
const { toBN, fromWei } = require('web3-utils');


const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoints.xdai));


web3.eth.net.isListening()
    .then(() => console.log('tulip-data is connected'))
    .catch(e => console.log('Wow. Something went wrong: '+ e));

const generateContractFunctionList = ({ tokens, blockNumber, user_address}) => {
    const batch = new web3.BatchRequest();

    tokens.map(async ({ address: tokenAddress, symbol, decimals }) => {
        const contract = new web3.eth.Contract(ERC20Abi);
        contract.options.address = tokenAddress;

        batch.add(contract.methods.balanceOf(user_address).call.request({}, blockNumber));
    });

    return batch;
};

const convertToNumber = (hex, decimals) => {
    const balance = toBN(hex);
    return fromWei(balance);
};


module.exports = {
    generateContractFunctionList,
    convertToNumber
};