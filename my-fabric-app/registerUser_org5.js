const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Load the network configuration for Org5
        const ccpPath = path.resolve(__dirname, '..', 'test-network', 'organizations', 'peerOrganizations', 'org5.example.com', 'connection-org5.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA of Org5.
        const caURL = ccp.certificateAuthorities['ca.org5.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system-based wallet for managing identities of Org5.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user for Org5.
        const userIdentity = await wallet.get('appUserOrg5');
        if (userIdentity) {
            console.log('An identity for the user "appUserOrg5" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user for Org5.
        const adminIdentity = await wallet.get('adminOrg5');
        if (!adminIdentity) {
            console.log('An identity for the admin user "adminOrg5" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application for Org5 before retrying');
            return;
        }

        // Build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'adminOrg5');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org5.department1',
            enrollmentID: 'appUserOrg5',
            role: 'client'
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'appUserOrg5',
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org5MSP',  // Specify Org5's MSP ID
            type: 'X.509',
        };
        await wallet.put('appUserOrg5', x509Identity);
        console.log('Successfully registered and enrolled user "appUserOrg5" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to register user "appUserOrg5": ${error}`);
        process.exit(1);
    }
}

main();
