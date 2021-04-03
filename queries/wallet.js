const fetch = require('node-fetch');

const pageResults = require('graph-results-pager');

const { request, gql } = require('graphql-request');


const { ERC20Abi, coingeckoAPIEndpoints, graphAPIEndpoints, tokenLists, rpcEndpoints } = require('./../constants');

const { generateContractFunctionList, convertToNumber } = require('./../utils');

module.exports = {
    //fetches prices of xdai token ids from coingecko
    async tokenPrices({token_ids = undefined} = {}) {
        const params = new URLSearchParams({
            vs_currencies: 'usd',
            contract_addresses: token_ids
        });

        let data = await fetch(coingeckoAPIEndpoints.prices + params, {
            method: 'GET',
            headers: {'Content-Type': 'application/json',},
        }).then(response => {
            return response.json();
        });

        return data;
    },

    //fetches the honeyswap token list
    async tokens() {
        let data = await fetch(tokenLists.honeyswap, {
            methods: 'GET',
            headers: {'Content-Type': 'application/json',}
        }).then(response => {
            return response.json();
        });

        return data.tokens;
    },

    //gets a list of all non zero token balances in an wallet address
    async tokenBalances({user_address = undefined} = {}) {
        if (!user_address) {
            throw new Error("honeycomb-data: User address undefined");
        }

        const tokens = await module.exports.tokens();

        const batch = generateContractFunctionList({ tokens, user_address: user_address });
        // query block number
        // const batch = generateContractFunctionList({ tokens, blockNumber: 11633038 });

        const results = [];
        const { response } = await batch.execute();

        let tokenIds = [];

        response.forEach(({ _hex }, index) => {
            const { name, decimals, symbol } = tokens[index];
            if(_hex !== '0x00') {
                results.push({
                    balance: `${convertToNumber(_hex, decimals)}`,
                    ...tokens[index]
                })
                //collect all non zero value token addresses
                tokenIds.push(tokens[index].address);
            }
        });

        //get prices for the tokens on coingecko and add the values to the result
        const prices = await module.exports.tokenPrices({token_ids: tokenIds});
        results.forEach( token => {
            const price = prices[token.address];
            if(price) {
                token.priceUSD = price.usd;
                //token.currency = 'usd';
                token.valueUSD = token.balance * price.usd;
            }
        });

        return tokenBalances.callback(results);
    },
    //TODO: add more exchanges/only works with honeyswap subgraph and tokenlist for now
    async poolBalances({block = undefined, timestamp = undefined, user_address = undefined} = {}) {
        if(!user_address) { throw new Error("sushi-data: User address undefined"); }

        const properties = [
            'id',
            'liquidityPositions { liquidityTokenBalance, pair { token0 { id, derivedETH }, token1 { id, derivedETH }, reserve0, reserve1, reserveUSD, totalSupply} }'
        ];

        const poolData =  await pageResults({
            api: graphAPIEndpoints.honeyswap_v2,
            query: {
                entity: 'users',
                selection: {
                    where: {
                        id: `\\"${user_address.toLowerCase()}\\"`
                    },
                    block: block ? { number: block } : timestamp ? { number: await timestampToBlock(timestamp) } : undefined,
                },
                properties: properties
            }
        })
        .then(results => {return results})
        .catch(err => console.log(err));

        const tokens = await module.exports.tokens();
        let  tokensById= [];
        tokens.forEach(token => {
            tokensById[token.address.toLowerCase()] = token;
        });

        let results = [];
        if(poolData && poolData[0] && poolData[0].liquidityPositions) {
            const pairs = poolData[0].liquidityPositions.forEach(position => {

                let token0 = tokensById[position.pair.token0.id];
                if(!token0) {
                    throw new Error("honeycomb-data: Token0 address not found:".position.pair.token0.id);
                }
                let token1 = tokensById[position.pair.token1.id];
                if(!token1) {
                    throw new Error("honeycomb-data: Token1 address not found:".position.pair.token1.id);
                }
                /*
                    get liquidity value of single token

                    getLiquidityValue()
                    from: https://github.com/Uniswap/uniswap-v2-sdk/blob/main/src/entities/pair.ts
                    JSBI.divide(JSBI.multiply(liquidity.raw, this.reserveOf(token).raw), totalSupplyAdjusted.raw)

                    let liquidityValueUSD = position.liquidityTokenBalance * position.pair.reserve0 / position.pair.totalSupply;
                    liquidityValueUSD = liquidityValueUSD * position.pair.token0.derivedETH * 2;
                */
                token0.balance = position.liquidityTokenBalance * position.pair.reserve0 / position.pair.totalSupply;
                token1.balance = position.liquidityTokenBalance * position.pair.reserve1 / position.pair.totalSupply;

                //in this case eth == dai == usd
                token0.priceUSD = position.pair.token0.derivedETH;
                token1.priceUSD = position.pair.token1.derivedETH;

                token0.valueUSD = token0.balance * position.pair.token0.derivedETH;
                token1.valueUSD = token1.balance * position.pair.token1.derivedETH;

                /* get usd value of owned pool tokens */
                const liquidityValueUSD = position.pair.reserveUSD / position.pair.totalSupply * position.liquidityTokenBalance;

                if(position.liquidityTokenBalance <= 0)
                    return;

                results.push({
                    tokens: [
                        token0,
                        token1
                    ],
                    balance: position.liquidityTokenBalance,
                    valueUSD: liquidityValueUSD
                });
            });

            return poolBalances.callback(results);

        }
    }
}

const tokenBalance = {
    /*
    properties: [
        'balance',
        'name',
        'address',
        'symbol',
        'logoURI',
        'priceUsd',
        'valueUsd'
    ],
     */

    callback(entry) {
        return {
            balance: Number(entry.balance),
            name: entry.name,
            address: entry.address,
            symbol: entry.symbol,
            logoURI: entry.logoURI,
            priceUSD: Number(entry.priceUSD),
            valueUSD: Number(entry.valueUSD)
        };
    }
};

const tokenBalances = {

    callback(results) {
        return results.map(entry => tokenBalance.callback(entry));
    }
};

const poolBalances = {

    callback(results) {
        results.map( entry => {
            let result = {
                balance: Number(entry.balance),
                valueUSD: Number(entry.valueUSD)
            };
            result.tokens = entry.tokens.map(token => tokenBalance.callback(token));
        });
        return results;
    }
};