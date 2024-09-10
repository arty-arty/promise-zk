const snarkjs = require("snarkjs");
const fs = require("fs");
const { string_to_curve, message_to_professor_key, random_keys } = require("../boneh-encode/hash_to_curve");
const { vkey_serialize, vkey_prepared_serialize, proof_serialize, public_input_serialize } = require("../ark-serializer/pkg_node");
require('dotenv').config();
const { exit } = require("process");

const { getFullnodeUrl, SuiClient} = require('@mysten/sui/client');
const { Transaction } =  require('@mysten/sui/transactions');

global.WebSocket = require('ws');

//const { mainnetConnection, testnetConnection, TransactionBlock, Ed25519Keypair, JsonRpcProvider, RawSigner} = require('@mysten/sui');
// const { BCS, getSuiMoveConfig } = require("@mysten/bcs");

// const bcs = new BCS(getSuiMoveConfig());

//Please write verifier_pkg id in package.id text file. Notice it is automatically done when deployed with deploy.js
const verifier_pkg = fs.readFileSync('package.id', 'utf8').trim();
console.log(verifier_pkg);

//!!Please notice that it must be kept secret!!
//In production this oracle code runs on a secure server
//Which only professor - key holder - can access
//Key is a random number less than cyclic subgroup order 2736030358979909402780800718157159386076813972158567259200215660948447373041
const questions = [
    "What is Sui? [[OPTIONS]]: A) A decentralized social media platform, B) A high-performance Layer 1 blockchain, C) A centralized cryptocurrency exchange, D) A digital wallet for cryptocurrencies",
    "Which company developed the Sui blockchain? [[OPTIONS]]: A) Meta (formerly Facebook), B) Google, C) Mysten Labs, D) ConsenSys",
    "What programming language is used to write smart contracts on the Sui blockchain?",
    "What consensus mechanism does Sui use? [[OPTIONS]]: A) Proof of Work, B) Proof of Stake, C) Delegated Proof of Stake, D) Proof of Authority",
    "What is a unique feature of Sui's transaction processing model? [[OPTIONS]]: A) It processes transactions sequentially, B) It uses a shared global state for all transactions, C) It can process transactions in parallel, D) It does not require network nodes",
    "How does Sui achieve horizontal scalability? [[OPTIONS]]: A) By increasing the block size, B) Through sharding, C) By allowing parallel execution of independent transactions, D) By reducing the number of validators",
    "Which Sui component ensures the execution order of transactions? [[OPTIONS]]: A) The Sui runtime, B) The Move language compiler, C) Narwhal and Tusk consensus algorithms, D) The storage layer",
    "What is the maximum transaction per second (TPS) that Sui aims to achieve under ideal conditions? [[OPTIONS]]: A) 1,000 TPS, B) 10,000 TPS, C) 100,000 TPS, D) Over 100,000 TPS",
    "What is the primary advantage of using the Move programming language in Sui? [[OPTIONS]]: A) It is a visual programming language, B) It is specifically designed to be verifiable for safety and correctness, C) It does not require any programming knowledge, D) It is compatible with all other blockchain networks",
    "How does Sui handle gas fees in its network? [[OPTIONS]]: A) Gas fees are fixed for all transactions, B) Gas fees are dynamically adjusted based on network congestion, C) There are no gas fees on Sui, D) Gas fees are paid in Bitcoin",
    "What are the first and last names of Mysten Labs' chief cryptographer? (Write the first and last names separated by a space.)"
];

const right_answers = [
    "B", // Correct answer for Question 1
    "C", // Correct answer for Question 2
    "Move", // Correct answer for Question 3
    "B", // Correct answer for Question 4
    "C", // Correct answer for Question 5
    "C", // Correct answer for Question 6
    "C", // Correct answer for Question 7
    "D", // Correct answer for Question 8
    "B", // Correct answer for Question 9
    "B",  // Correct answer for Question 10
    "Kostas Chalkias"  // Correct answer for Question 11
];
const P_xys_and_questions = [];

// console.log({new_keys: random_keys(right_answers.length)})
// exit()

//In production keys must be hidden in an env variable as well as right answers must obviously be hidden
const professor_keys =
    ["1584561490597234433444721371246996260316395925710778034972022929403589928560", "1410523144184515777705721561525132755984757303790778555698000198872570973948", "2211933601623746611877623626873082931036517988692641262731707744872542102186", "1522596334424819636784622426810666362696836890847847151062537141929370205291", "209330872829481859569795846101062234955973291048986126021494216656963038797", "2349895726214586051357600667715319630797313624396531540458161051149774098858", "780123089888020003087146613328142767205283238274756800514815288874580637612", "1560514486413613444052071663845660984464173894650740924867363336655922953416", "2472648307804323050578394844362124582754807480943942341280966472739176106294", "1306979738630964261343556470111870705700372528619825035958764397416544966797", "1851659862352020081593121292647193772176362222589488194749815741671376983728"];

console.log({ professor_keys });

for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const right_answer = right_answers[index];
    const professor_key = professor_keys[index];
    const { xx: P_x, yy: P_y } = string_to_curve(right_answer);
    P_xys_and_questions.push({ question, P_x, P_y, professor_key });
}
const mnemonic = process.env.PHRASE;
const net = process.env.NET;

//!!End of must be kept secret section!!

function arr_to_bigint(arr) {
    //let arr = new Uint8Array(buf);
    let result = BigInt(0);
    for (let i = arr.length - 1; i >= 0; i--) {
        result = result * BigInt(256) + BigInt(arr[i]);
    }
    return result;
}

function arr_from_hex(hexString) {
    const _hexString = hexString.replace("0x", "");
    console.log(_hexString);
    const hex = Uint8Array.from(Buffer.from(_hexString, 'hex'));
    console.log(hex);
    return hex;
}

function addr_to_bigint(addr, flush = true) {
    const interm = arr_from_hex(addr);
    //Zeroize the last - most significant byte of address to prevent the number being bigger than base Field modulo
    if (flush) interm[31] = 0;
    return arr_to_bigint(interm);
}

const utf8_hex_to_int = (by) => {
    const st = Buffer.from(by).toString('utf8');
    //console.log({ st })
    const arr = Uint8Array.from(Buffer.from(st, 'hex'));
    //console.log({ arr })
    return arr_to_bigint(arr)
}

const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
const rpcUrl = getFullnodeUrl(net); 
// create a client connected to devnet
const client = new SuiClient({ url: rpcUrl });

async function prepare(P_x, P_y, professor_key) {
    const addr = keypair.toSuiAddress();

    const addr_for_proof = addr_to_bigint(addr).toString();
    console.log(addr_for_proof);

    const { proof: proof_upload_quest, publicSignals: publicSignals_upload_quest } = await snarkjs.groth16.fullProve({ address: addr_for_proof, a: professor_key, P_x, P_y }, "compiled_circuits/commit_main.wasm", "compiled_circuits/commit_main.groth16.zkey");
    console.log({ P_x, P_y, proof_upload_quest: JSON.stringify(proof_upload_quest), publicSignals_upload_quest })

    return { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest }
}

async function create_game() {
    const tx = new Transaction();

    tx.moveCall({
        target: verifier_pkg + '::verifier::professor_create_game',
        typeArguments: [],
        arguments: [],
        gasBudget: 10000
    }
    )
    const result = await client.signAndExecuteTransaction({transaction: tx, signer: keypair});
    console.log({ result });

    await new Promise(r => setTimeout(r, 10000));

    //Lookup this transaction block by digest
    const effects = await client.getTransactionBlock({
        digest: result.digest,
        // only fetch the effects field
        options: { showEffects: true },
    });
    console.log({ result }, effects, effects.effects.created[0].reference.objectId);
    const created = effects.effects.created.filter(effect => "Shared" in effect.owner)
    console.log(created)
    const game_id = created[0].reference.objectId;
    console.log({ game_id });

    const gameObject = await client.getObject({
        id: game_id,
        options: { showContent: true },
    });
    console.log({ gameObject });


    const profiles_id = gameObject?.data?.content?.fields?.profiles?.fields?.id?.id;
    const answers_id = gameObject?.data?.content?.fields?.answers?.fields?.id?.id;


    fs.writeFileSync('game.id', game_id, (err) => {
        if (err) throw err;
        console.log('Game ID saved to file!');
    });

    fs.writeFileSync('profiles.id', profiles_id, (err) => {
        if (err) throw err;
        console.log('Game ID saved to file!');
    });

    fs.writeFileSync('answers.id', answers_id, (err) => {
        if (err) throw err;
        console.log('Game ID saved to file!');
    });

    // Replace the content of 'quest.id' with an empty text file
    // fs.writeFile('quest.id', '', (err) => {
    //     if (err) throw err;
    //     console.log('quest.id has been replaced with an empty file!');
    // });
    return game_id;
}

//TODO: Batch all quest uploads in one programmable transaction
//Do all the preparation when new in one run without exits
async function upload_quest(game_id, P_xy_and_question) {
    const { question, P_x, P_y, professor_key } = P_xy_and_question
    const { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest } = await prepare(P_x, P_y, professor_key)

    //Now serialzie with my ark-serialize the proof
    const proof_serialized = proof_serialize(JSON.stringify(proof_upload_quest));
    console.log({ proof_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals = publicSignals_upload_quest.map((input) => public_input_serialize(input))
    console.log({ signals })

    const [professor_k_hash, kP_x, kP_y, _] = signals
    console.log(professor_k_hash, kP_x, kP_y);

    //Check proof
    const vKey = JSON.parse(fs.readFileSync("compiled_circuits/commit_main.groth16.vkey.json"));

    const res = await snarkjs.groth16.verify(vKey, publicSignals_upload_quest, proof_upload_quest);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    //Send the transaction to the verifier implemented in ../sui-verifier/sources/dev_verifier.moive on-chain smart contract
    const tx = new Transaction();

    // Smart contract verifier::professor_create_quest method signature   
    // public entry fun professor_create_quest(game: &mut Game, points: u64, image_blob: vector<u8>, question: vector<u8>, 
    // proof:vector<u8>, professor_k_hash: vector<u8>,
    // professor_kP_x: vector<u8>, professor_kP_y: vector<u8>, ctx: &mut TxContext)
    tx.moveCall({
        target: verifier_pkg + '::verifier::professor_create_quest',
        typeArguments: [],
        arguments: [
            tx.object(game_id),
            tx.pure.u64(1),
            tx.pure("string", "data: image blob placeholder for now"),
            tx.pure("string", question),
            tx.pure.string(proof_serialized),
            tx.pure.string(professor_k_hash),
            tx.pure.string(kP_x),
            tx.pure.string(kP_y),
        ],
        gasBudget: 10000
    }
    )
    const result = await client.signAndExecuteTransaction({transaction: tx, signer: keypair});
    console.log({ result });

    await new Promise(r => setTimeout(r, 2000));

    //const result = { digest: "3DCpgh2iRkRgbYG8L6mFChez73YWpbKdFh7uMBK6wPXQ" };
    //Lookup this transaction block by digest
    const effects = await client.getTransactionBlock({
        digest: result.digest,
        // only fetch the effects field
        options: { showEffects: true },
    });

    console.log({ result }, effects, effects.effects.created[0].reference.objectId);
    const created = effects.effects.created.filter(effect => "Shared" in effect.owner)
    console.log(created)
    const quest_id = created[0].reference.objectId;

    fs.readFile('quest.ids', 'utf8', (err, data) => {
        //if (err && err.code !== 'ENOENT') throw err; // Throw if error is not file not found (ENOENT)

        let contentToAppend = quest_id;

        if (data && data.length > 0) {
            // If the file has content, append the quest_id with a new line
            contentToAppend = '\n' + quest_id;
        }

        fs.appendFile('quest.ids', contentToAppend, (err) => {
            if (err) throw err;
            console.log('Quest ID appended to file without extra new line at the end!');
        });
    });

    //And fill table_id
}

async function process_answer(quest_id, game_id, student_address, student_aH_x, student_aH_y, P_xy_and_question) {
    const { question, P_x, P_y, professor_key } = P_xy_and_question;
    const { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest } = await prepare(P_x, P_y, professor_key);
    console.log({ student_address, student_aH_x, student_aH_y });

    const professor_k_hash_int = publicSignals_upload_quest[0];

    //Convert address, student_aH_x, student_aH_y to decimal numbers represented as a string
    //const student_address_int = addr_to_bigint(student_address).toString()
    const student_aH_x_int = utf8_hex_to_int(student_aH_x).toString()
    const student_aH_y_int = utf8_hex_to_int(student_aH_y).toString()

    //BEGIN: Generate unlock proof of professor multiplied student point with her same key 
    const { proof: proof_unlock, publicSignals: publicSignals_unlock } = await snarkjs.groth16.fullProve({ address: addr_for_proof, k: professor_key, hash_k: professor_k_hash_int, aH_x: student_aH_x_int, aH_y: student_aH_y_int }, "compiled_circuits/unlock_main.wasm", "compiled_circuits/unlock_main.groth16.zkey");
    console.log({ proof: JSON.stringify(proof_unlock), publicSignals_unlock })

    const proof_unlock_serialized = proof_serialize(JSON.stringify(proof_unlock));
    console.log({ proof_unlock_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals_unlock = publicSignals_unlock.map((input) => public_input_serialize(input))
    console.log({ signals_unlock })

    const [kaH_x, kaH_y, , ,] = signals_unlock
    console.log({ kaH_x, kaH_y });
    //END: Generate unlock proof of professor multiplied student point with her same key//

    //And send it to the contract for verification
    const tx = new Transaction();

    //Smart contract method signature of professor_score_answer(shared_quest: &mut Quest, student: address, 
    //proof:vector<u8>, professor_out_kaH_x: vector<u8>, professor_out_kaH_y: vector<u8>, ctx: &mut TxContext)
    tx.moveCall({
        target: verifier_pkg + '::verifier::professor_score_answer',
        typeArguments: [],
        arguments: [
            tx.object(quest_id),
            tx.object(game_id),
            tx.object(student_address),

            tx.pure("string", proof_unlock_serialized),
            tx.pure("string", kaH_x),
            tx.pure("string", kaH_y),
        ],
        gasBudget: 10000
    }
    )
    const result = await client.signAndExecuteTransaction({transaction: tx, signer: keypair}).catch((err) => console.log("We had a transaction error", err));
    console.log({ result });
}

async function table_field_to_answer(quest_ids, game_id, table_field, P_xys_and_questions) {
    const { data: { content: { fields: value } = {} } = {} } = await client.getObject({
        id: table_field,
        // fetch the object content field
        options: { showContent: true },
    });
    const { quest = '', student_address = '', student_aH_x = '', student_aH_y = '' } = value?.value?.fields ?? {};
    const index = quest_ids.indexOf(quest);
    const P_xy_and_question = P_xys_and_questions[index];

    if (student_address != '') await process_answer(quest, game_id, student_address, student_aH_x, student_aH_y,
        P_xy_and_question);
}

async function run() {
    let quest_ids = null;
    let game_id = null;


    try {
        game_id = fs.readFileSync('game.id', 'utf8').trim();
        answers_id = fs.readFileSync('answers.id', 'utf8').trim();
    }
    catch {
        game_id = await create_game();
        exit();
    }

    try {
        quest_ids = fs.readFileSync('quest.ids', 'utf-8').split('\n').map(line => line.trim());
    }
    catch {
        for (let index = 0; index < P_xys_and_questions.length; index++) {
            const P_xy_and_question = P_xys_and_questions[index];
            await upload_quest(game_id, P_xy_and_question);
            await new Promise(r => setTimeout(r, 1 * 1000));
        }
        exit();
    }
    // try {
    //     quest_id = fs.readFileSync('quest.id', 'utf8').trim();
    // }
    // catch { 
    //     await upload_quest() 
    // }


    if (game_id) {

        while (1 == 1) {
            
                try {
                    // const quest_id = quest_ids[index];
                    // const P_xy_and_question = P_xys_and_questions[index];
    
                    // const objects = await client.getDynamicFields({
                    //     parentId: quest_id,
                    //     // fetch the object content field
                    //     //options: { showContent: true },
                    // });
                    // const table_id = objects.data[0].objectId;

                    //Do below every 10 seconds
                    const table_fields = await client.getDynamicFields({
                        parentId: answers_id,
                        // fetch the object content field
                        //options: { showContent: true },
                    });
                    console.log(table_fields);
                    
                    //Now in parallel launch process all the answers found not just [0]
                    //Better aggregate this in one transaction and think about the new launch
                    //Because 1 sec is not enough to update to see the result of the new transaction
                    //maybe 3 sec now?
                    //table_fields.data.map(async (obj) => await table_field_to_answer(quest_ids, game_id, obj.objectId, P_xys_and_questions).catch((e) => { console.log(e) }));
                    //Better to push all in one transaction block instead of now [0]
                    if (table_fields?.data?.length > 0)
                        await table_field_to_answer(quest_ids, game_id, table_fields.data[0].objectId, P_xys_and_questions).catch((e) => { console.log(e) });
                    console.log("Checked all new answers, now do the 1.0 seconds pause");
                    await new Promise(r => setTimeout(r, 1000));
                }
                catch (err) {
                    console.log("For some reason failed to process answers", err)
                }
            }
            
        }
    }



run()

// run_events = async () => {
// const MoveEventType = '<PACKAGE_ID>::<MODULE_NAME>::<METHOD_NAME>';


// let unsubscribe = await client.subscribeEvent({
// 	filter: { Package: verifier_pkg },
// 	onMessage: (event) => {
// 		console.log('subscribeEvent', JSON.stringify(event, null, 2));
// 	},
// });

// process.on('SIGINT', async () => {
// 	console.log('Interrupted...');
// 	if (unsubscribe) {
// 		await unsubscribe();
// 		unsubscribe = undefined;
// 	}
// });
// }

// run_events()

// const {  SuiHTTPTransport } = require('@mysten/sui/client');

// async function test() {
// const client = new SuiClient({
//         transport: new SuiHTTPTransport({
//                 url: 'https://fullnode.mainnet.sui.io:443',
//                 websocket: {
//                         reconnectTimeout: 1000,
//                         url: 'wss://rpc.mainnet.sui.io:443',
//                 },
//         }),
// }); 
 
// const unsubscribe = await client.subscribeEvent({
//         filter: {
//                   All: [],
//                 },
//         onMessage(event) {
//             // handle subscription notification message here. This function is called once per subscription message.
//             console.log(event);
//         },
// });
// }

// test()