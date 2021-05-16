const fetch = require('node-fetch');

const pageResults = require('graph-results-pager');

const {
	multicallAddresses,
	graphAPIEndpoints,
	tokenLists,
	rpcEndpoints,
	mapping,
	mappingInvert,
} = require('./../constants');

const Multicall = require('@makerdao/multicall');

let tokens = [];
const tokensById = {};

module.exports = {
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

		//fetch xdai balance
		multicallQuery.push({
			call: ['getEthBalance(address)(uint256)', user_address],
			returns: [['xdai', val => val / 10 ** 18]],
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
					nonzeroBalances[key.toLowerCase()] = value;
					gqlIds.push('\\"' + key.toLowerCase() + '\\"');
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
			const balance = Number(nonzeroBalances[token.id]);
			const result = {
				...tokensById[token.id],
				balance: balance.valueOf(),
				priceUSD: Number(token.derivedETH),
				valueUSD: Number(token.derivedETH * nonzeroBalances[token.id]),
			};
			results.push(result);
		});

		//add the user wallet xdai balance
		results.push({
			balance: nonzeroBalances['xdai'].valueOf(),
			priceUSD: 1,
			valueUSD: nonzeroBalances['xdai'],
			name: 'xDai',
			symbol: 'xDai',
			logoURI: tokensById['0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'.toLowerCase()].logoURI, //wxdai logo
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
			'liquidityPositions { liquidityTokenBalance, pair { id, token0 { id, symbol, name, derivedETH }, token1 { id, symbol, name, derivedETH }, reserve0, reserve1, reserveUSD, totalSupply} }',
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

		if (poolData && poolData[0] && poolData[0].liquidityPositions) {
			const pairData = await module.exports.pairData(poolData[0].liquidityPositions, 'Honeyswap');
			return poolBalances.callback(pairData);
		}
	},
	async stakedBalances({ user_address = undefined } = {}) {
		const farm = require('./farm');

		const deposits = await farm.deposits({ user_address });

		const pairIds = [];
		const liquidityPositions = [];
		const liquidityPositionsById = {};
		deposits.forEach(deposit => {
			pairIds.push(deposit.pool);
			const position = {
				liquidityTokenBalance: deposit.amount,
				address: deposit.pool.toLowerCase(),
				pair: undefined,
			};
			if (!liquidityPositionsById[deposit.pool.toLowerCase()]) {
				liquidityPositionsById[deposit.pool.toLowerCase()] = [];
			}
			liquidityPositionsById[deposit.pool.toLowerCase()].push(position);
		});
		const pairsPrices = await module.exports.pairsPrices({ pairs: pairIds });

		pairsPrices.forEach(pair => {
			const positions = liquidityPositionsById[pair.id.toLowerCase()];
			positions.forEach(position => {
				position.pair = pair;
				liquidityPositions.push(position);
			});
		});

		const pairData = await module.exports.pairData(liquidityPositions, 'Tulip');

		return poolBalances.callback(pairData);
	},
	async simplyTokenBalances({ user_address = undefined, network = 'xdai', tokens = undefined, web3 = undefined } = {}) {
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
			web3: web3,
			multicallAddress: multicallAddresses[network],
		};

		return await Multicall.aggregate(multicallQuery, config).then(result => {
			return result.results.transformed;
		});
	},
	async pairData(positions, platform) {
		const tokensById = [];
		const tokens = await module.exports.tokens();

		tokens.forEach(token => {
			tokensById[token.address.toLowerCase()] = token;
		});

		const results = [];
		positions.forEach(position => {
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
			const liquidityValueUSD = (position.pair.reserveUSD / position.pair.totalSupply) * position.liquidityTokenBalance;

			if (position.liquidityTokenBalance <= 0) return;

			results.push({
				tokens: [token0, token1],
				address: position.pair.id,
				balance: position.liquidityTokenBalance,
				valueUSD: liquidityValueUSD,
				platform: platform,
			});
		});
		return results;
	},
	//fetches the honeyswap token list
	async tokens() {
		if (tokens.length > 0) {
			return tokens;
		}
		const data = await fetch(tokenLists.honeyswap, {
			methods: 'GET',
			headers: { 'Content-Type': 'application/json' },
		}).then(response => {
			return response.json();
		});

		tokens = data.tokens;
		return tokens;
	},

	async tokensById() {
		if (tokensById.length > 0) {
			return tokensById;
		}
		const tokens = await module.exports.tokens();

		tokens.forEach(token => {
			tokensById[token.address.toLowerCase()] = token;
		});
		return tokensById;
	},
	async pairsPrices({ pairs = undefined } = {}) {
		const gqlIds = [];
		pairs.forEach(pair => {
			if (mapping[pair]) {
				pair = mapping[pair]; //map to xdai pools TODO: remove
			}
			gqlIds.push('\\"' + pair.toLowerCase() + '\\"');
		});

		const gqlIdQuery = '[' + gqlIds.join(',') + ']';

		const properties = [
			'id',
			'token0 { id, symbol, name, derivedETH }',
			'token1 { id, symbol, name, derivedETH }',
			'reserve0',
			'reserve1',
			'reserveUSD',
			'totalSupply',
		];
		const pairsData = await pageResults({
			api: graphAPIEndpoints.honeyswap_v2,
			query: {
				entity: 'pairs',
				selection: {
					where: {
						id_in: gqlIdQuery,
					},
				},
				properties: properties,
			},
		})
			.then(results => {
				return results;
			})
			.catch(err => console.log(err));

		const tokensById = await module.exports.tokensById();

		pairsData.forEach(pair => {
			let i = 0;
			do {
				const token = tokensById[pair['token' + i].id.toLowerCase()];
				let logoURI = null;
				if (token) {
					logoURI = token.logoURI;
				}
				pair['token' + i].logoURI = logoURI;
				i++;
			} while (pair['token' + i] !== undefined);
			//TODO: remove
			if (mappingInvert[pair.id]) {
				pair.id = mappingInvert[pair.id];
			}
		});

		return pairsData;
	},

	async tokensPrices({ tokens = undefined } = {}) {
		const gqlIds = [];
		tokens.forEach(token => {
			gqlIds.push('\\"' + token.toLowerCase() + '\\"');
		});

		const gqlIdQuery = '[' + gqlIds.join(',') + ']';
		const properties = ['id', 'symbol', 'derivedETH'];

		const data = await pageResults({
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

		return data;
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
				address: entry.address,
				poolPlatform: entry.poolPlatform ? entry.poolPlatform : undefined,
				stakePlatform: entry.stakePlatform ? entry.stakePlatform : undefined,
				status: entry.status ? entry.status : undefined,
			};
			result.tokens = entry.tokens.map(token => tokenBalance.callback(token));
		});
		return results;
	},
};
