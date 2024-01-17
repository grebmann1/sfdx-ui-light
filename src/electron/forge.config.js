module.exports = {
	packagerConfig: {
		asar: true,
		prune:true,
		icon:'../../public/sfdx_gui.icns',
		osxSign: {} // object must exist even if empty
	},
	rebuildConfig: {},
	makers: [
		{
			name: '@electron-forge/maker-zip',
			platforms: ['darwin'],
		}
	],
	plugins: [
		{
			name: '@electron-forge/plugin-auto-unpack-natives',
			config: {}
		}
	],
	publishers: [
		{
		  	name: '@electron-forge/publisher-github',
		  	config: {
				repository: {
						owner: 'grebmann1',
						name: 'sfdx-ui-light'
				},
				prerelease: true
		  	}
		}
	]
};