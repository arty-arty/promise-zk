require('dotenv').config();
const mnemonic = process.env.PHRASE;

const { localnetConnection, testnetConnection, mainnetConnection, TransactionBlock, Ed25519Keypair, JsonRpcProvider, RawSigner, mnemonicToSeed, Ed25519PublicKey, hasPublicTransfer } = require('@mysten/sui.js');

const keypair = Ed25519Keypair.deriveKeypair(mnemonic);

const provider = new JsonRpcProvider(mainnetConnection);
const signer = new RawSigner(keypair, provider);
const fs = require("fs");

async function publish(cliPath, packagePath) {
    const { execSync } = require('child_process');

    //Compile .move into base64 bytecode
    const { modules, dependencies } = JSON.parse(
        execSync(
            `${cliPath} move build --dump-bytecode-as-base64 --path ${packagePath}`,
            { encoding: 'utf-8' },
        ),
    );
    const tx = new TransactionBlock();
    const [upgradeCap] = tx.publish({
        modules,
        dependencies,
    });
    tx.transferObjects([upgradeCap], tx.pure(await signer.getAddress()));

    //Send the transaction to publish it and obtain Upgrade Capability
    const result = await signer.signAndExecuteTransactionBlock({
        transactionBlock: tx,
    });
    console.log({ result });

    //A hardcoded digest for debug purpose
    //const result = { digest: "CexfXgF67BTmZ9jjuDpc5wzRA4LzpjY61B1s9chEh6yW" };

    //Lookup this transaction block by digest
    await new Promise(r => setTimeout(r, 10000));

    const effects = await provider.getTransactionBlock({
        digest: result.digest,
        // only fetch the effects field
        options: { showEffects: true },
    });

    //And find the right transaction which created the contract
    const created = effects.effects.created.filter(effect => effect.owner == "Immutable")
    console.log({ result }, effects.effects.created, created, effects.effects.created[0].reference.objectId);

    const package_id = created[0].reference.objectId;

    //Output the new created package id in a text file
    fs.writeFile('package.id', package_id, (err) => {
        if (err) throw err;
        console.log('Package ID saved to file!');
    });


}

publish("sui", "../sui-verifier")