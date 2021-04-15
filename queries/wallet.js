const fetch = require('node-fetch');

const pageResults = require('graph-results-pager');

const { multicallAddresses, graphAPIEndpoints, tokenLists, rpcEndpoints } = require('./../constants');

const Multicall = require('@makerdao/multicall');

module.exports = {
	//fetches the honeyswap token list
	async tokens() {
		const data = await fetch(tokenLists.honeyswap, {
			methods: 'GET',
			headers: { 'Content-Type': 'application/json' },
		}).then(response => {
			return response.json();
		});

		return data.tokens;
	},

	async simplyTokenBalances({
		user_address = undefined,
		network = 'xdai',
		tokens = undefined,
		rpc_endpoint = undefined,
	} = {}) {
		if (!user_address) {
			throw new Error('tulip-data: User address undefined');
		}

		//const tokens = await module.exports.tokens();
		const multicallQuery = [];

		tokens.forEach(token => {
			multicallQuery.push({
				target: token,
				call: ['balanceOf(address)(uint256)', user_address],
				returns: [[token]],
			});
		});

		const config = {
			rpcUrl: rpc_endpoint ? rpc_endpoint : rpcEndpoints[network],
			multicallAddress: multicallAddresses[network],
		};

		return await Multicall.aggregate(multicallQuery, config).then(result => {
			return result.results.transformed;
		});
	},

	//gets a list of all non zero token balances in an wallet address
	async tokenBalances({ user_address = undefined, network = 'xdai' } = {}) {
		if (!user_address) {
			throw new Error('tulip-data: User address undefined');
		}

		const tokens = await module.exports.tokens();
		const multicallQuery = [];

		tokens.forEach(token => {
			multicallQuery.push({
				target: token.address,
				call: ['balanceOf(address)(uint256)', user_address],
				returns: [[token.address, val => val / 10 ** token.decimals]],
			});
		});

		const config = {
			rpcUrl: rpcEndpoints[network],
			multicallAddress: multicallAddresses[network],
		};

		const nonzeroBalances = {};
		let gqlIdQuery = '';

		await Multicall.aggregate(multicallQuery, config).then(resultObject => {
			const gqlIds = [];

			Object.entries(resultObject.results.transformed).forEach(([key, value]) => {
				if (value !== 0) {
					nonzeroBalances[key] = value;
					gqlIds.push('\\"' + key + '\\"');
				}
			});

			gqlIdQuery = '[' + gqlIds.join(',') + ']';
		});

		//get data from honeyswap
		const properties = ['id', 'symbol', 'derivedETH'];

		const tokenData = await pageResults({
			api: graphAPIEndpoints.honeyswap_v2,
			query: {
				entity: 'tokens',
				selection: {
					where: {
						id_in: gqlIdQuery,
					},
					block: undefined,
				},
				properties: properties,
			},
		})
			.then(results => {
				return results;
			})
			.catch(err => console.log(err));

		const tokensById = {};
		tokens.forEach(entry => {
			tokensById[entry.address.toLowerCase()] = {
				address: entry.address.toLowerCase(),
				...entry,
			};
		});

		const results = [];
		tokenData.forEach(token => {
			results.push({
				balance: nonzeroBalances[token.id],
				priceUSD: token.derivedETH,
				valueUSD: token.derivedETH * nonzeroBalances[token.id],
				...tokensById[token.id],
			});
		});

		return tokenBalances.callback(results);
	},
	//TODO: add more exchanges/only works with honeyswap subgraph and tokenlist for now
	async poolBalances({ block = undefined, user_address = undefined } = {}) {
		if (!user_address) {
			throw new Error('tulip-data: User address undefined');
		}

		const properties = [
			'id',
			'liquidityPositions { liquidityTokenBalance, pair { token0 { id, symbol, name, derivedETH }, token1 { id, symbol, name, derivedETH }, reserve0, reserve1, reserveUSD, totalSupply} }',
		];

		const poolData = await pageResults({
			api: graphAPIEndpoints.honeyswap_v2,
			query: {
				entity: 'users',
				selection: {
					where: {
						id: `\\"${user_address.toLowerCase()}\\"`,
					},
					block: block ? block : undefined,
				},
				properties: properties,
			},
		})
			.then(results => {
				return results;
			})
			.catch(err => console.log(err));

		const tokens = await module.exports.tokens();
		const tokensById = [];
		tokens.forEach(token => {
			tokensById[token.address.toLowerCase()] = token;
		});

		const results = [];
		if (poolData && poolData[0] && poolData[0].liquidityPositions) {
			poolData[0].liquidityPositions.forEach(position => {
				let token0 = tokensById[position.pair.token0.id];
				if (!token0) {
					token0 = {
						name: position.pair.token0.name,
						symbol: position.pair.token0.symbol,
						address: position.pair.token0.id,
						logoURI: null,
					};
				}
				let token1 = tokensById[position.pair.token1.id];
				if (!token1) {
					token1 = {
						name: position.pair.token1.name,
						symbol: position.pair.token1.symbol,
						address: position.pair.token1.id,
						logoURI: null,
					};
				}

				/*
					get liquidity value of single token

					getLiquidityValue()
					from: https://github.com/Uniswap/uniswap-v2-sdk/blob/main/src/entities/pair.ts
					JSBI.divide(JSBI.multiply(liquidity.raw, this.reserveOf(token).raw), totalSupplyAdjusted.raw)

					let liquidityValueUSD = position.liquidityTokenBalance * position.pair.reserve0 / position.pair.totalSupply;
					liquidityValueUSD = liquidityValueUSD * position.pair.token0.derivedETH * 2;
				*/
				token0.balance = (position.liquidityTokenBalance * position.pair.reserve0) / position.pair.totalSupply;
				token1.balance = (position.liquidityTokenBalance * position.pair.reserve1) / position.pair.totalSupply;

				//in this case eth == dai == usd
				token0.priceUSD = position.pair.token0.derivedETH;
				token1.priceUSD = position.pair.token1.derivedETH;

				token0.valueUSD = token0.balance * position.pair.token0.derivedETH;
				token1.valueUSD = token1.balance * position.pair.token1.derivedETH;

				/* get usd value of owned pool tokens */
				const liquidityValueUSD =
					(position.pair.reserveUSD / position.pair.totalSupply) * position.liquidityTokenBalance;

				if (position.liquidityTokenBalance <= 0) return;

				results.push({
					tokens: [token0, token1],
					balance: position.liquidityTokenBalance,
					valueUSD: liquidityValueUSD,
				});
			});

			return poolBalances.callback(results);
		}
	},
};

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
			valueUSD: Number(entry.valueUSD),
		};
	},
};

const tokenBalances = {
	callback(results) {
		return results.map(entry => tokenBalance.callback(entry));
	},
};

const poolBalances = {
	callback(results) {
		results.map(entry => {
			const result = {
				balance: Number(entry.balance),
				valueUSD: Number(entry.valueUSD),
			};
			result.tokens = entry.tokens.map(token => tokenBalance.callback(token));
		});
		return results;
	},
};
