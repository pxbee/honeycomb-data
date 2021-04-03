module.exports = {
    graphAPIEndpoints: {
        honeyswap_v2: 'https://api.thegraph.com/subgraphs/name/1hive/honeyswap-v2'
    },

    coingeckoAPIEndpoints: {
        prices: 'https://api.coingecko.com/api/v3/simple/token_price/xdai?'
    },

    tokenLists: {
        honeyswap: 'https://tokens.honeyswap.org'
    },

    rpcEndpoints: {
        xdai: 'https://dai.poa.network'
    },
    ERC20Abi: [
        {
            constant: true,
            inputs: [
                {
                    name: '_owner',
                    type: 'address',
                },
            ],
            name: 'balanceOf',
            outputs: [
                {
                    name: 'balance',
                    type: 'uint256',
                },
            ],
            payable: false,
            stateMutability: 'view',
            type: 'function',
        },
    ]

}
