const wallet = require('./../queries/wallet');

const main = async () => {
	//array of tokens contracts to call
	const tokens = [{ address: '0x3050e20fabe19f8576865811c9f28e85b96fa4f9', decimals: 18 }];
	const tokenBalances = await wallet.simplyTokenBalances({
		user_address: '0x...',
		network: 'rinkeby',
		tokens: tokens,
	});
	console.log(tokenBalances);
};
main();
