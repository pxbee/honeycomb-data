module.exports = {
	graphAPIEndpoints: {
		honeyswap_v2: 'https://api.thegraph.com/subgraphs/name/1hive/honeyswap-v2',
		honeyfarm: 'https://api.thegraph.com/subgraphs/name/pxbee/tulip',
		celeste: 'https://api.thegraph.com/subgraphs/name/1hive/celeste\n',
	},

	tokenLists: {
		honeyswap: 'https://tokens.honeyswap.org',
	},

	rpcEndpoints: {
		xdai: 'https://dai.poa.network',
		rinkeby: 'https://rinkeby.eth.aragon.network/',
	},

	multicallAddresses: {
		xdai: '0xb5b692a88BDFc81ca69dcB1d924f59f0413A602a',
		rinkeby: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
	},

	tokenAddresses: {
		hny: '0x71850b7e9ee3f13ab46d67167341e4bdc905eef9',
		xcomb: '0x50dbde932a94b0c23d27cdd30fbc6b987610c831',
	},

	pairAddresses: {
		xcomb_wxdai: '0x20f5640639094e4c4e9522113786cf0788f7dcca' //actually alvin
	},
	/*
const mapping = {
	'0xa30ccf67b489d627de8f8c035f5b9676442646e0': '0x71850b7E9Ee3f13Ab46d67167341E4bDc905Eef9', //hny
	'0xae88624c894668e1bbabc9afe87e8ca0fb74ec2a': '0x3a97704a1b25F08aa230ae53B352e2e72ef52843', //agve
	'0xc778417e063141139fce010982780140aa0cd5ab': '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1', //weth
	'0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea': '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', //wxdai
};
 */
	mapping: {
		'0xa30ccf67b489d627de8f8c035f5b9676442646e0': '0x4505b262dc053998c10685dc5f9098af8ae5c8ad', //hny wxdai
		'0xae88624c894668e1bbabc9afe87e8ca0fb74ec2a': '0x0e3e9cceb13c9f8c6faf7a0f00f872d6291630de', //agve wxdai
		'0xc778417e063141139fce010982780140aa0cd5ab': '0x7bea4af5d425f2d4485bdad1859c88617df31a67', //weth wxdai
		'0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea': '0x01f4a4d82a4c1cf12eb2dadc35fd87a14526cc79', //wxdai usdc
	},
	mappingInvert: {
		'0x4505b262dc053998c10685dc5f9098af8ae5c8ad': '0xa30ccf67b489d627de8f8c035f5b9676442646e0', //hny wxdai
		'0x0e3e9cceb13c9f8c6faf7a0f00f872d6291630de': '0xae88624c894668e1bbabc9afe87e8ca0fb74ec2a', //agve wxdai
		'0x7bea4af5d425f2d4485bdad1859c88617df31a67': '0xc778417e063141139fce010982780140aa0cd5ab', //weth wxdai
		'0x01f4a4d82a4c1cf12eb2dadc35fd87a14526cc79': '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea', //wxdai usdc
	},
};
