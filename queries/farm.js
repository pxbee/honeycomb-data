const pageResults = require('graph-results-pager');

const { graphAPIEndpoints } = require('./../constants');
const { request, gql } = require('graphql-request');

module.exports = {
	async info({ block = undefined, timestamp = undefined } = {}) {
		block = block ? block : timestamp ? await timestampToBlock(timestamp) : undefined;
		block = block ? `block: { number: ${block} }` : '';

		const result = await request(
			graphAPIEndpoints.honeyfarm,
			gql`{
                    honeyFarms {
                        ${info.properties.toString()}
                    }
                }`,
		);
		return info.callback(result.honeyFarms[0]);
	},

	async pools({ block = undefined, timestamp = undefined } = {}) {
		return pageResults({
			api: graphAPIEndpoints.honeyfarm,
			query: {
				entity: 'pools',
				selection: {
					block: block ? { number: block } : timestamp ? { number: await timestampToBlock(timestamp) } : undefined,
				},
				properties: pools.properties,
			},
		})
			.then(results => pools.callback(results))
			.catch(err => console.log(err));
	},

	async deposits({ block = undefined, timestamp = undefined, user_address = undefined } = {}) {
		return pageResults({
			api: graphAPIEndpoints.honeyfarm,
			query: {
				entity: 'deposits',
				selection: {
					where: {
						user: `\\"${user_address.toLowerCase()}\\"`,
						status: 'Open',
					},
					block: block ? { number: block } : timestamp ? { number: await timestampToBlock(timestamp) } : undefined,
				},
				properties: deposits.properties,
			},
		})
			.then(results => deposits.callback(results))
			.catch(err => console.log(err));
	},

	async apys({ block = undefined, timestamp = undefined } = {}) {
		const info = await module.exports.info();
		const pools = await module.exports.pools();

		const now = Math.floor(new Date().getTime() / 1000);
		const startTime = info.startTime.getTime() / 1000;
		const endTime = info.endTime.getTime() / 1000;

		const from = BigInt(now - startTime);
		const to = BigInt(endTime - startTime);

		/*
		console.log('start', startTime);
		console.log('end', endTime);
		console.log(info.totalHsf);

		 */
		const startDistribution = BigInt(info.startDistribution);

		const distributionSlope = BigInt(info.distributionSlope);
		const scale = BigInt(info.scale);

		const hsfInTime = ((to - from) * (2n * startDistribution - (distributionSlope * (from + to)))) / 2n;

		const hsfScaled = Number(hsfInTime / scale) / info.scale;
		pools.forEach(pool => {
			pool.hsfInPool = hsfScaled / info.totalAllocPoint * pool.allocPoint;
			pool.baseApy = 0;
			pool.rewardApy = 0;
			pool.totalApy = 0;
		});

		return pools;
	},
};

const info = {
	properties: [
		'id',
		'owner',
		'startTime',
		'endTime',
		'hsf',
		'totalHsf',
		'totalAllocPoint',
		'startDistribution',
		'distributionSlope',
		'scale',
		'poolCount',
		'updatedAt',
	],

	callback(results) {
		return {
			id: results.id,
			owner: results.owner,
			startTime: new Date(results.startTime * 1000),
			endTime: new Date(results.endTime * 1000),
			hsf: results.hsf,
			totalHsf: results.totalHsf,
			startDistribution: results.startDistribution,
			distributionSlope: results.distributionSlope,
			scale: results.scale,
			totalAllocPoint: Number(results.totalAllocPoint),
			poolCount: Number(results.poolCount),
			updatedAt: new Date(results.updatedAt * 1000),
		};
	},
};

const pools = {
	properties: [
		'id',
		'balance',
		'openDepositCount',
		'allocPoint',
		'lastRewardTimestamp',
		'accHsfPerShare',
		'totalShares',
		'timestamp',
		'block',
		'updatedAt',
		'hsfHarvested',
	],

	callback(results) {
		return results.map(
			({
				id,
				balance,
				openDepositCount,
				allocPoint,
				lastRewardTimestamp,
				accHsfPerShare,
				totalShares,
				timestamp,
				block,
				updatedAt,
				hsfHarvested,
			}) => ({
				pair: id,
				balance: Number(balance) / 1e18,
				openDepositCount: Number(openDepositCount),
				allocPoint: Number(allocPoint),
				lastRewardTimestamp: new Date(lastRewardTimestamp * 1000),
				accHsfPerShare: Number(accHsfPerShare),
				totalShares: Number(totalShares),
				addedDate: new Date(timestamp * 1000),
				addedBlock: Number(block),
				updatedAt: new Date(updatedAt * 1000),
				hsfHarvested: Number(hsfHarvested),
			}),
		);
	},
};

const deposits = {
	properties: [
		'id',
		'user { id }',
		'pool { id }',
		'amount',
		'rewardDebt',
		'unlockTime',
		'rewardShare',
		'setRewards',
		'referrer',
		'timestamp',
		'block',
		'status',
	],

	callback(results) {
		return results.map(
			({
				id,
				user,
				pool,
				amount,
				rewardDebt,
				unlockTime,
				rewardShare,
				setRewards,
				referrer,
				timestamp,
				block,
				status,
			}) => ({
				id: id,
				user: user.id,
				pool: pool.id,
				amount: Number(amount) / 1e18,
				rewardDept: Number(rewardDebt) / 1e18 / 1e18,
				unlockTime: new Date(unlockTime * 1000),
				rewardShare: Number(rewardShare) / 1e18,
				setRewards: Number(setRewards),
				referrer: referrer,
				addedDate: new Date(timestamp * 1000),
				addedBlock: Number(block),
				status: status,
			}),
		);
	},
};
