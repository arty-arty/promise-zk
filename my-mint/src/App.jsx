import React, { useState, useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { ConnectButton, WalletKitProvider } from "@mysten/wallet-kit";

import { useWalletKit, ConnectModal } from "@mysten/wallet-kit";
import { formatAddress } from "@mysten/sui.js";

import { ZqField, Scalar } from "ffjavascript";

import { string_to_curve } from "../../boneh-encode/hash_to_curve.mjs";

import * as wasm from "../../ark-serializer/pkg/ark_serializer_bg.wasm";
import { __wbg_set_wasm } from "../../ark-serializer/pkg/ark_serializer_bg.js";
import {
  proof_serialize,
  public_input_serialize,
} from "../../ark-serializer/pkg/ark_serializer_bg.js";

import {
  testnetConnection,
  mainnetConnection,
  TransactionBlock,
  JsonRpcProvider,
} from "@mysten/sui.js";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

//The following four functions are just playing with encoding between field Big integers
//and their representations inside of the smart contract

function arr_to_bigint(arr) {
  let result = BigInt(0);
  for (let i = arr.length - 1; i >= 0; i--) {
    result = result * BigInt(256) + BigInt(arr[i]);
  }
  return result;
}

function arr_from_hex(hexString) {
  const _hexString = hexString.replace("0x", "");
  const utf8Encoder = new TextEncoder();
  const utf8Decoder = new TextDecoder();
  const bytes = utf8Encoder.encode(_hexString);
  const hex = new Uint8Array(bytes.length / 2);

  for (let i = 0; i < bytes.length; i += 2) {
    const byte1 = bytes[i] - 48 > 9 ? bytes[i] - 87 : bytes[i] - 48;
    const byte2 = bytes[i + 1] - 48 > 9 ? bytes[i + 1] - 87 : bytes[i + 1] - 48;
    hex[i / 2] = byte1 * 16 + byte2;
  }

  return hex;
}

const utf8_hex_to_int = (by) => {
  console.log({ by });
  const hex = new TextDecoder().decode(new Uint8Array(by));
  const arr = new Uint8Array(
    hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
  return arr_to_bigint(arr);
};

function addr_to_bigint(addr) {
  const interm = arr_from_hex(addr);
  //Zeroize the last - most significant byte of address to prevent the number being bigger than base Field modulo
  interm[31] = 0;
  return arr_to_bigint(interm);
}

//Generate a random one-time key to multiply by professors result
const r = Scalar.fromString(
  "2736030358979909402780800718157159386076813972158567259200215660948447373041"
);
const F = new ZqField(r);

//Get .move package on Sui testnet address from .env
const verifier_pkg = process.env.packageId;
const quest_ids = process.env.questIds;
const game_id = process.env.gameId;

console.log({ verifier_pkg, quest_ids });

//Define the styled components for the demo website
const Container = styled.div`
  padding: 30px;
  border-radius: 40px;
  background-color: #b67bdb;
  ${(props)=> props.isShaking ? "animation: blink-red 2.0s ease;": ""}
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 1000px;
  max-width: 500px;
  width: 500px;
  max-height: 1000px;

  @keyframes blink-red {
  0% { background-color: rgba(255, 0, 0, 0.8); transform: translateX(-10px); }
  10% { transform: translateX(0px); }
  20% { transform: translateX(+10px); }
  30% { transform: translateX(0px);}
  100% { background-color: #b67bdb; }}

  @keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-10px); }
  40%, 80% { transform: translateX(10px); }
  }

}
`;

const ImageLogo = styled.img`
  margin-left: 20px;
  width: 262px;
  align-self: flex-start;
  justify-self: flex-start;
`;

const Image = styled.img`
  width: 70%;
  align-self: center;
  justify-self: center;
`;

const ButtonImg = styled.img`
  width: 90%;
  align-self: center;
  justify-self: center;
`;

const QuestionImg = styled.img`
  margin-bottom: 20px;
  width: ${(props) => props.width};
  margin-top: ${(props) => props.marginTop};
  align-self: center;
  justify-self: center;
`;

const Question = styled.h2`
  font-family: "Krub", sans-serif;
  font-size: 24px;
  margin-bottom: 20px;
  margin-top: -15px;
  color: #ffffff;
  text-align: center;
`;

const Hint = styled.p`
  font-family: "Krub", sans-serif;
  font-size: 19px;
  margin-bottom: 20px;
  color: #000;
  text-align: center;
`;

const Input = styled.input`
  //margin-top: 10px;
  font-family: "Krub", sans-serif;
  width: 70%;
  height: 40px;
  padding: 10px;
  //margin-bottom: 20px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.0); 
  border: 2px solid white; 
  font-size: 26px;
  color: #ffffff;
  text-align: center;
  ::placeholder {
    color: #BABABA;
  }
  &:focus {
    outline: 5px solid #DBFF00;
  }
`;

const Button = styled.button`
  font-family: "Krub", sans-serif;
  background-color: #00c853;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  //box-shadow: 0px 5px 5px rgba(0, 0, 0, 0.5);
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: #C9FF55;
    //box-shadow: 0px 7px 7px rgba(0, 0, 0, 0.5);
    transform: translateY(-2px);
  }

  &:focus {
    outline: 5px solid #A23EE0;
  }

  &:active {
    background-color: #8EF66A;
    //box-shadow: 0px 2px 2px rgba(0, 0, 0, 0.5);
    transform: translateY(2px);
  }
`;

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(255, 223, 0, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 223, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 223, 0, 0);
  }
`;

const MintButton = styled(Button)`
  animation: ${pulse} 2s infinite;
  width: 200px;
  height: 50px;
  font-size: 24px;
  font-weight: 900;
  border-radius: 15px;
  font-family: "Krub", sans-serif;
  background-color: #dbff00;
  margin-top: 20px;
`;

const Form = styled.form`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  align-self: center;
  max-width: 500px;
  width: 90%;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  justify-self: center;
  width: 100%;
  margin-bottom: 20px;
`;

const Flex = styled.div`
  margin-bottom: 50px;
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  //align-items: flex-end;
  //justify-content: flex-end;
  justify-self: flex-start;
  align-self: flex-start;
  width: 100%;
  margin-top: 20px;
`;

const InputColumn = styled(Column)``;

const ImageColumn = styled(Column)`
  margin-top: 20px;
`;

//import ReactTooltip from 'react-tooltip'; // Import react-tooltip
import { Tooltip as ReactTooltip } from 'react-tooltip'; // Import as named export

// Styled components for the Question Selector
const Container1 = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0px;
`;

const NumberContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-content: center;
  margin: 20px 0;
`;
//'#dbff00'
const NumberButton = styled.div`
  width: ${(props) => props.isChosen ? "37px" : "30px"}; /* Circle size adjusted */
  height: ${(props) => props.isChosen ? "37px" : "30px"};
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${(props) =>
    props.isChosen ? '#dbff00' : props.done ? '#C0C0C0' : "#ffffff"};
  color: #b67bdb;
  font-size: 14px;
  font-weight: bold;
  border-radius: 50%;
  cursor: ${(props) => (props.done ? 'not-allowed' : 'pointer')};
  transition: transform 0.2s ease, background-color 0.2s ease;

  &:hover {
    transform: ${(props) => (props.isChosen ? 'none' : 'scale(1.23)')};
  }
`;

// transform: ${(props) => (props.isChosen ? 'scale(1.23)' : 'none')};
// background-color: ${(props) =>
//   props.isChosen ? '#f4ff81' : props.done ? '#ef9a9a' : '#76ff03'};

const ArrowButton = styled.button`
  background-color: transparent;
  border: none;
  font-size: 24px;
  color: white;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease;

  &:hover {
    color: #dbff00;
    transform: scale(1.2);
  }

  &:disabled {
    color: #bdc3c7;
    cursor: not-allowed;
  }
`;

const TooltipText = styled.span`
  color: ${(props) => (props.isDone ? '#e57373' : '#00c853')};
  font-family: "Krub", sans-serif;
`;

// Conversion function: number to alphabet
const numberToAlphabet = (num) => {
  return num;
  //for now disabled
  return String.fromCharCode(65 + num - 1); // 'A' = 65
};

// Main component
const NumberSelector = ({ max, doneList, setQuestNumber, questNumber }) => {
  const handleClick = (num) => {
    //Allow chosing again for now
    if (!doneList.includes(num)) {
      setQuestNumber(num);
    }
    //setQuestNumber(num);
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (questNumber < max) {
      setQuestNumber(questNumber + 1);
    }
  };

  const handlePrevious = (e) => {
    e.preventDefault();
    if (questNumber > 1) {
      setQuestNumber(questNumber - 1);
    }
  };

  return (
    <Container1>
      {/* <div>
        <ArrowButton data-tip="Previous Question" onClick={handlePrevious} disabled={questNumber === 1}>
          ⬅️
        </ArrowButton>
        <ArrowButton data-tip="Next Question" onClick={handleNext} disabled={questNumber === max}>
          ➡️
        </ArrowButton>
      </div> */}

      <NumberContainer>
        {Array.from({ length: max }, (_, index) => {
          const number = index + 1;
          const isDone = doneList.includes(number);
          const isChosen = questNumber === number;

          return (
            <div key={number} style={{ jusifyContent: "center", alignContent: "center" }}>
              <NumberButton
                data-tip={isDone ? `Question ${numberToAlphabet(number)} is already answered.` : "Click to select this question!"}
                done={isDone}
                isChosen={isChosen}
                onClick={() => handleClick(number)}
              >
                {numberToAlphabet(number)}
              </NumberButton>
              <ReactTooltip />
            </div>
          );
        })}
      </NumberContainer>
      <ReactTooltip />
    </Container1>
  );
};

// Styled component for grid container
const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  margin: 0 auto;
`;

// Styled component for grid item (choice button)
const ChoiceButton = styled.button`
  padding: 10px;
  font-size: 22px;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 2px solid #ffffff;
  text-align: center;
  cursor: pointer;

  &:hover {
    background-color: rgba(255, 255, 255, 0.4);
    border-color : #dbff00;
  }

  
  &:active {
    outline : 0px;
    background-color : rgba(219, 255, 0, 1.0);
  }

  // &:focus {
  //   outline: 5px solid #DBFF00;
  // }
`;

// &focus {
//   outline : 0px;
// }

const StyledText = styled.div`
  color: #DBFF00; /* Bright yellow text */
  font-family: "Poppins", sans-serif;
  font-weight: 900; /* Black weight */
  font-size: 30px; /* Adjust size according to your design */
  padding: 10px 20px; /* Add padding for better layout */
  text-align: center; /* Center align the text */
`;

// Main component
const QuestionWithChoices = ({ questionText, setAnswer, handleSubmit, currentAccount, setOpen }) => {
  // Function to parse options from the question text
  const parseOptions = (text) => {
    const optionsPart = text.match(/\[\[OPTIONS\]\]:\s*(.*)$/)?.[1];
    if (!optionsPart) return [];
    return optionsPart.split(', ').map(option => option.trim());
  };

  // Get the options
  const options = parseOptions(questionText);

  // Handle option click
  const handleOptionClick = (option) => {
    setAnswer(option.split(')')[0]);
    handleSubmit(option, currentAccount, setOpen); // Invoke handleSubmit after setting the answer
  };

  return (
    <>
      <GridContainer>
        {options.map((option, index) => (
          <ChoiceButton key={index} onClick={() => handleOptionClick(option)}>
            {option}
          </ChoiceButton>
        ))}
      </GridContainer>
    </>
  );
};

//A component that is a wallet connect button
const ConnectToWallet = React.forwardRef((props, ref) => {
  const { currentAccount } = useWalletKit();
  return (
    <ConnectButton
      connectText={"Connect Wallet"}
      connectedText={
        currentAccount && `Connected: ${formatAddress(currentAccount.address)} Score: ${props?.level}`
      }
      class={"myInput"}
      style={{
        justifySelf: "flex-end",
        marginRight: 20,
        marginTop: 6,
        backgroundColor: "#DBFF00",
        color: "#B67BDB",
        width: 120,
        height: 80,
        fontWeight: "bold",
        padding: "0em 0em",
        fontSize: 15,
        alignSelf: "center"
      }}
    />
  );
});

//A function where the main work happens
//Here we prove the arithmetic circuits with snarkjs, serialize the data with ark-works
//And send transaction to Sui network smart contract
async function answer_quest(snarkjs, addr, quest_id, student_answer) {
  const student_key = F.random().toString();
  //Encode the answer to a point on elliptic curve using try-and-increment method
  const { xx: student_H_x, yy: student_H_y } = string_to_curve(student_answer);

  const addr_for_proof = addr_to_bigint(addr).toString();
  console.log(addr_for_proof);

  //BEGIN: Generate commit proof for student answer point on elliptic curve//
  const { proof: proof_commit, publicSignals: publicSignals_commit } =
    await snarkjs.groth16.fullProve(
      {
        address: addr_for_proof,
        a: student_key,
        P_x: student_H_x,
        P_y: student_H_y,
      },
      "compiled_circuits/commit_main.wasm",
      "compiled_circuits/commit_main.groth16.zkey"
    );
  console.log({
    student_H_x,
    student_H_y,
    proof: JSON.stringify(proof_commit),
    publicSignals_commit,
  });

  const proof_commit_serialized = proof_serialize(JSON.stringify(proof_commit));
  console.log({ proof_commit_serialized });

  //Now serialzie with my ark-serialize the public inputs
  const signals_commit = publicSignals_commit.map((input) =>
    public_input_serialize(input)
  );
  console.log({ signals_commit });

  const [student_a_hash_int, student_aH_x_int, student_aH_y_int] =
    publicSignals_commit;
  const [student_a_hash, student_aH_x, student_aH_y] = signals_commit;
  console.log(student_a_hash, student_aH_x, student_aH_y);
  //END: Generate commit proof for student answer point on elliptic curve//

  //Here we must retrieve from Sui api professor_kP_x and professor_kP_y written in this shared Quest object
  //And convert this vector<u8> array the right way into a number for the proving system
  //make it professor_kP_x_int, professor_kP_y_int
  const {
    data: { content: quest_object },
  } = await provider.getObject({
    id: quest_id,
    // fetch the object content field
    options: { showContent: true },
  });
  console.log({ quest_object });
  const { professor_kP_x, professor_kP_y } = quest_object.fields;

  //Convert bytes to utf-8 string
  //Then decode this hex encoded string to bytes
  //Take those bytes and convert to number
  //Take into account that the first byte is the least significant byte
  const professor_kP_x_int = utf8_hex_to_int(professor_kP_x).toString();
  const professor_kP_y_int = utf8_hex_to_int(professor_kP_y).toString();

  console.log({
    quest_object,
    professor_kP_x,
    professor_kP_y,
    professor_kP_x_int,
    professor_kP_y_int,
  });

  //BEGIN: Generate unlock proof of student multiplied professors point with her same key
  const { proof: proof_unlock, publicSignals: publicSignals_unlock } =
    await snarkjs.groth16.fullProve(
      {
        address: addr_for_proof,
        k: student_key,
        hash_k: student_a_hash_int,
        aH_x: professor_kP_x_int,
        aH_y: professor_kP_y_int,
      },
      "compiled_circuits/unlock_main.wasm",
      "compiled_circuits/unlock_main.groth16.zkey"
    );
  console.log({ proof: JSON.stringify(proof_unlock), publicSignals_unlock });

  const proof_unlock_serialized = proof_serialize(JSON.stringify(proof_unlock));
  console.log({ proof_unlock_serialized });

  //Now serialzie with my ark-serialize the public inputs
  const signals_unlock = publicSignals_unlock.map((input) =>
    public_input_serialize(input)
  );
  console.log({ signals_unlock });

  const [akP_x, akP_y, , ,] = signals_unlock;
  console.log({ akP_x, akP_y });
  //END: Generate unlock proof of student multiplied professors point with her same key//

  //Send the transaction to the verifier implemented in ../sui-verifier/sources/dev_verifier.moive on-chain smart contract
  const tx = new TransactionBlock();

  //In 1 SUI 1_000_000_000 MIST
  //Just 1000 MIST - a small amount for test; Though in production it reqires 0.1 SUI to deincentivize bruteforcing
  //You might set any ammount needed in dev_verifier.move and tweak it here accordingly
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(1000)]);

  //Smart contract method signature of student_answer_question(shared_quest: &mut Quest, c: coin::Coin<SUI>, proof_commit: vector<u8>,
  //student_a_hash: vector<u8>, student_aH_x: vector<u8>, student_aH_y: vector<u8>,
  //proof_unlock: vector<u8>, akP_x: vector<u8>, akP_y: vector<u8>, ctx: &TxContext)

  //Here we assemble a transaction in agreement with this method signature
  tx.moveCall({
    target: verifier_pkg + "::verifier::student_answer_question",
    typeArguments: [],
    arguments: [
      tx.pure(game_id),
      tx.pure(quest_id),
      coin,

      tx.pure(proof_commit_serialized),
      tx.pure(student_a_hash),
      tx.pure(student_aH_x),
      tx.pure(student_aH_y),

      tx.pure(proof_unlock_serialized),
      tx.pure(akP_x),
      tx.pure(akP_y),
      tx.pure(
        "0x0000000000000000000000000000000000000000000000000000000000000006"
      ),
    ],
    gasBudget: 10000,
  });
  console.log({ tx });
  return tx;
}

const provider = new JsonRpcProvider(mainnetConnection);

import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

function arrayToDict(array) {
  const dict = {};
  if (!array) return dict;
  array.forEach(entry => {
    const key = entry.fields.key;
    const value = entry.fields.value;
    dict[key] = value;
  });
  return dict;
}

function compareAndNotify(oldState, newState, notifyChange) {
  const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)]);

  allKeys.forEach(key => {
    const oldValue = oldState[key];
    const newValue = newState[key];
    console.log({ oldValue, newValue });
    if (oldValue !== newValue) {
      // Call your custom notification function with the key and new value
      notifyChange(key, newValue);
    }
  });
}

const Main = () => {
  //Initialize the state of react application with data we may want to track
  //And which influences the outcome of program execution
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("Welcome! Your question is loading...");

  const [image, setImage] = useState("/question-mark.png");
  const [spinning, setSpinning] = useState(true);
  const [showPopup, setShowPopup] = useState(true);
  const [objects, setObjects] = useState([]);

  const [open, setOpen] = useState(false);
  const [gotIt, setGotIt] = useState(0);

  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize(); // Get window size for confetti effect

  // Method to trigger confetti when the answer is right
  const triggerConfetti = () => {
    setShowConfetti(true);
    console.log("Triggered confetti!")
    setTimeout(() => setShowConfetti(false), 3000); // Stop after 3 seconds
  };
  //Load the wasm for my ark-serialzier module
  //It works fine without it in dev mode i.e (npm run dev)
  //But in production mode like on netlify vite "forgets" to do it, so we manually should init the module here
  useEffect(() => {
    __wbg_set_wasm(wasm);
    console.log("wasm set");
  }, []);

  //Use wallet hook given by MystenLabs to propose transactions and see current connected account address
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  const [level, setLevel] = useState(0);
  const [answeredRight, setAnsweredRight] = useState(null);
  const [answeredWrong, setAnsweredWrong] = useState(null);

  const [questNumber, setQuestNumber] = useState(1);

  const answeredWrongRef = useRef(answeredWrong); // Create a ref to hold the current value of answeredWrong
  const answeredRightRef = useRef(answeredRight);

  const [isShaking, setIsShaking] = useState(false);
  const [showRedOverlay, setShowRedOverlay] = useState(false);

  const handleWrongAnswer = () => {
    // Trigger shake and red overlay
    setIsShaking(true);
    setShowRedOverlay(true);

    // Stop the shake effect after 0.5s (duration of the shake animation)
    setTimeout(() => setIsShaking(false), 2*1000);

    // Stop the red overlay effect after 0.3s (duration of the blink animation)
    setTimeout(() => setShowRedOverlay(false), 2*1000);
  };

  //Here is every 2 seconds checker for changes in the list of objects owned by a person
  //If it changes and she suddenly gets an NFT then we congratulate
  //If it changes and the player gets wrong answer record the we say sorry and encourage trying more
  // useEffect(() => {
  //   const intervalId = setInterval(async () => {
  //     //Fetch owned object
  //     const fetchedObjects = await provider.getOwnedObjects({
  //       owner: currentAccount.address,
  //       options: { showContent: true },
  //     });
  //     fetchedObjects.data.map((obj) => {
  //       delete obj.data.digest;
  //       delete obj.data.version;
  //     });

  //     console.log({ fetchedObjects });
  //     if (objects.length == 0) {
  //       console.log("objects were set")
  //       setObjects(fetchedObjects);
  //       return;
  //     }

  //     if (
  //       JSON.stringify(objects) !== JSON.stringify(fetchedObjects) &&
  //       objects?.data?.length > 0 &&
  //       fetchedObjects?.data?.length > 0
  //     ) {
  //       setObjects(fetchedObjects);
  //       console.log("changed objects");

  //       //We need a system with sets because by default versions and digests of objects might change
  //       //Like when sending coins to interact with this contract
  //       //It would give us a false start without proper tracking
  //       const set2 = new Set(objects.data.map((obj) => obj.data.objectId));
  //       const set1 = new Set(
  //         fetchedObjects.data.map((obj) => obj.data.objectId)
  //       );

  //       // Find the difference between set1 and set2
  //       const difference = new Set([...set1].filter((x) => !set2.has(x)));
  //       console.log({ set1, set2, difference });
  //       // Convert the resulting set back to an array
  //       const differenceArray = Array.from(difference);
  //       const diffObjArray = fetchedObjects.data.filter((obj) =>
  //         differenceArray.includes(obj.data.objectId)
  //       );
  //       console.log({ differenceArray, diffObjArray });

  //       //This is event of right answer when a person finally got rewarded with an NFT
  //       if (
  //         diffObjArray.some(
  //           (obj) =>
  //             obj?.data?.content?.type ===
  //             verifier_pkg + "::verifier::RightAnswerNFT"
  //         )
  //       ) {
  //         //setSpinning(false);
  //         setGotIt(gotIt + 1);
  //         triggerConfetti();
  //         toast.success(
  //           "Right! Look for a prize in your wallet when Score is 1, 3, 7, or 10!!!"
  //         );
  //         //setImage("/golden.png");
  //       }

  //       if (
  //         diffObjArray.some(
  //           (obj) =>
  //             obj?.data?.content?.type ===
  //             verifier_pkg + "::verifier::RewardNFT"
  //         )
  //       ) {
  //         //setSpinning(false);
  //         toast.success(
  //           `Congratulations! The NFT prize came to your wallet. Continue playing for more!!`
  //         );
  //         //setImage("/golden.png");
  //       }

  //       //This is event of wrong answer when a person just got a WrongAnswerNFT record
  //       if (
  //         diffObjArray.some(
  //           (obj) =>
  //             obj?.data?.content?.type ===
  //             verifier_pkg + "::verifier::WrongAnswerNFT"
  //         )
  //       ) {
  //         toast.error(
  //           "Sorry, the zk score came. It was a wrong answer. Please try more!!!"
  //         );
  //       }
  //     }
  //   }, 2000);



  //   return () => clearInterval(intervalId);
  // }, [objects, currentAccount]);

  const findFirstUnansweredQuestion = (quest_ids, answered_right) => {
    // Loop through quest_ids and find the first one that isn't in answered_right
    for (let i = 0; i < quest_ids.length; i++) {
      if (!answered_right.includes(quest_ids[i])) {
        // Return the question number (1-based index)
        return i + 1;
      }
    }

    // If all questions are answered
    return null; // or return a message like "All questions are answered"
  };

  //Here is every 2 seconds checker of a person's profile in this game
  useEffect(() => {
    const fetcher = async () => {
      //Fetch owned object
      const gameObject = await provider.getObject({
        id: game_id,
        options: { showContent: true },
      });
      // fetchedObjects.data.map((obj) => {
      //   delete obj.data.digest;
      //   delete obj.data.version;
      // });
      console.log({ gameObject });
      //Probably should set gameObject one time and stop the intervals!!!!!!

      const profilesTableId = gameObject?.data?.content?.fields?.profiles?.fields?.id?.id;
      console.log({ profilesTableId });

      //profiles table id could be stored by professor.js at creation
      //Statically
      //console.log({myaddress: currentAccount?.address, intervalId})

      if (currentAccount.address) {
        const table_field = await provider.getDynamicFieldObject({
          parentId: profilesTableId,
          //name: currentAccount?.address,
          name: {
            type: "address",
            value: currentAccount?.address,
          }

          //fetch the object content field
          //options: { showContent: true },
        });
        let { level, answered_right, wrong_attempts } = table_field?.data?.content?.fields?.value?.fields || {};
        console.log("Fetched profile: ", table_field?.data?.content?.fields?.value?.fields || {});
        const wrong_array = wrong_attempts?.fields?.contents;
        if (!answered_right) answered_right = [];
        const wrong_dict = arrayToDict(wrong_array);
        console.log({ wrong_dict })
        setLevel(level || 0);

        const onRightAnswer = (answeredRightRef.current) && (answeredRightRef.current?.length != answered_right?.length) && (answered_right?.length!=0);
        const onRightAnswerOrLoad = (answeredRightRef?.current?.length != answered_right?.length);

        console.log(answeredRightRef.current, answered_right);
        console.log(onRightAnswer);

        setAnsweredRight(answered_right);
        answeredRightRef.current = answered_right;

        //If possible switch to the first unanswered question.
        if (onRightAnswerOrLoad){
          const to_question_num = findFirstUnansweredQuestion(quest_ids, answered_right);
          setQuestNumber(to_question_num);
        }

        if (onRightAnswer) {
          const to_question_num = findFirstUnansweredQuestion(quest_ids, answered_right);
          console.log({ to_question_num });
          triggerConfetti();
          toast.success(
            "Right! Look for a prize in your wallet when Score is 1, 3, 7, or 10!!!"
          );
          setQuestNumber(to_question_num);
        }
        console.log({ level, answered_right });

        console.log(wrong_dict, answeredWrongRef.current)
        if (answeredWrongRef.current) compareAndNotify(wrong_dict, answeredWrongRef.current,
          (key, newValue) => {
            handleWrongAnswer();
            toast.error(
              `Sorry, the zk score came. It was a wrong answer. Please try more!!!`
            );
          }
        );
        setAnsweredWrong(wrong_dict);
        answeredWrongRef.current = wrong_dict;
        console.log("Set it the wrong to:", wrong_dict);
      }


    }
    fetcher();
    const intervalId = setInterval(fetcher, 2000);
    return () => { clearInterval(intervalId); console.log({ cleared: intervalId }) }
  }, [currentAccount, gotIt]);

  useEffect(() => {
    const fetch = async () => {
      const chosen_quest_id = quest_ids[questNumber - 1];
      console.log({ chosen_quest_id })
      const {
        data: { content: chosen_quest_object },
      } = await provider.getObject({
        id: chosen_quest_id,
        // fetch the object content field
        options: { showContent: true },
      });
      console.log({ chosen_quest_object })
      const question = chosen_quest_object?.fields?.question;
      setQuestion(question);
    }
    fetch().catch(() => { setQuestion("Question does not exist. Please try another one!") });
  }, [questNumber])

  const handleSubmit = async (event, currentAccount, setOpen) => {
    event.preventDefault();
    console.log({ event })
    //triggerConfetti();
    //Check if wallet connected if not open connector popup
    console.log({ currentAccount });
    if (!currentAccount?.address) {
      toast.error(
        "Please connect your wallet to Sui mainnet and submit again!"
      );
      setOpen(true);
      return;
    }

    //I temporarily allowed testnet, well for testing! Please uncomment this in production.
    if (!currentAccount?.chains?.some(obj => obj == "sui:mainnet")) {
      toast.error(
        "Please change to Sui mainnet, testnet or devnet will not work!"
      );
      return;
    }

    //Mention it should be mainnet
    //toast.error(
    //   "Sorry, the zk score came. It was a wrong answer. Please try more!!!"
    // );

    toast.info("Please approve the transaction to submit your answer :)");

    //TODO: Switcher that will switch to the next question of the game
    //It is a button arrows below
    //Now for new state there is new question id, so set it too
    //Most importantly based on quest_id, fetch its question as a text and put it into the app view

    //By the way sometimes fetch the current level of the person
    //And answered questions
    //And make button grey and saying already answered, if already answered

    //For now a simplified version
    const quest_id = quest_ids[questNumber - 1]

    //Use the function with zk proofs to generate the proving transaction
    const txBlock = await answer_quest(
      window.snarkjs,
      currentAccount.address,
      quest_id,
      answer
    );
    await signAndExecuteTransactionBlock({ transactionBlock: txBlock });

    //Warn that scoring by oracle run on my computer
    //Will take some time for transaction to pass
    //Hopefully the internet will not break!
    toast.warning("Please wait 10-20 seconds to get zkScored!");

    //Reset the answer field
    setAnswer("");
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent the default Enter key behavior in the input
      handleSubmit(event, currentAccount, setOpen);
    }
  };

  return (
    <>
      {showConfetti && <Confetti width={width} height={height} />}
      <ConnectModal
        open={open}
        onOpenChange={(isOpen) => setOpen(isOpen)}
        onClose={() => { setOpen(false) }}
        />
      <Container isShaking={isShaking}>
        <Flex>
          <ImageLogo src="/OGOGO.png" alt="Logo with text saying PROMISE" />

          <ConnectToWallet level={level}></ConnectToWallet>
          {/* <p>Your on-chain level: {level}; Reach 1 level for a 1$ worth NFT prize! </p> */}

        </Flex>
        {
          spinning ? (
            <Form onSubmit={(event) => handleSubmit(event, currentAccount, setOpen)}>
              <InputColumn>

                <StyledText
                  marginTop="100px">SUI Quest</StyledText>
                <NumberSelector
                  max={11}
                  doneList={answeredRight ? answeredRight.map(q => quest_ids.indexOf(q) + 1) : []}
                  setQuestNumber={setQuestNumber}
                  questNumber={questNumber}
                ></NumberSelector>
                <Question
                  style={{ marginBottom: 100 }}
                >
                  {question.includes("[[OPTIONS]]") ? question.split("[[OPTIONS]]")[0] : question}
                </Question>
                {/* <QuestionImg
                  width="100%"
                  src="/Who.svg"
                  alt="Question text: Who co-invented zero-knowledge-proofs?"
                />
                <QuestionImg
                  marginTop="25px"
                  width="100%"
                  src="/Variants8.svg"
                  alt="Answer variants: Vitalik Buterin, Changpeng Zhao, Silvio Micali, Satoshi Nakamoto"
                  />
                  <QuestionImg
                  marginTop="100px"
                  width="80%"
                  src="/askType.svg"
                  alt="Logo with text saying PROMISE"
                /> */}
                {/* answeredRight.includes(quest_ids[questNumber - 1]) */}
                {(false) ? (
                  <p>Good job! You briliantly answered this question. Remember? ;) Answer all other questions for the 10000$ prize.</p>
                ) : (<>

                  {/* <QuestionImg
                    marginTop="100px"
                    width="80%"
                    src="/askType.svg"
                    alt="Logo with text saying PROMISE"
                  /> */}
                  {question.includes("[[OPTIONS]]") ? <>
                    <StyledText
                      style={{ marginBottom: 20 }}>Pick your answer here</StyledText>
                    <QuestionWithChoices
                      questionText={question}
                      setAnswer={setAnswer}
                      handleSubmit={handleSubmit}
                      currentAccount={currentAccount}
                      setOpen={() => console.log("Opened")}
                    />

                  </>
                    : <>
                      <StyledText
                        marginTop="100px">Type your answer here</StyledText>
                      <Input
                        type="text"
                        placeholder="???"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <MintButton type="submit">
                        <ButtonImg
                          src="/zkAnswer.svg"
                          alt="Logo with text saying PROMISE"
                        />
                      </MintButton></>}

                </>
                )}
              </InputColumn>
            </Form>
          ) : (
            <ImageColumn>
              <QuestionImg
                marginTop="0px"
                width="80%"
                src="/Congrats.svg"
                alt="Logo with text saying PROMISE"
              />
              <Question>
                You answered right! The zkPrize you got in the
                wallet is special. It assures the contract got a valid zkProof of a matching
                answer.{" "}
              </Question>
              <Image src={image} alt="A reward coin" />
            </ImageColumn>
          )
          //
        }

     
      </Container>
      {/* Conditionally render the red overlay */}
    </>
  );
};

const App = () => {
  return (
    <WalletKitProvider>
      <ToastContainer />
      <Main></Main>
    </WalletKitProvider>
  );
};

export default App;
