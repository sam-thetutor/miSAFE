import React, { useState } from "react";

import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
} from "viem";
import { celoAlfajores } from "viem/chains";
import { FaWallet } from "react-icons/fa";
import BigNumber from "bignumber.js";
import { ClipLoader } from "react-spinners";
import {
  CeloVestContractAddress,
  cUSDContractAddress,
} from "../components/Utils/Constants";
import CUSDAbi from "../contracts/erc20.abi.json";
import CeloVestAbi from "../contracts/celovest.abi.json";
import { createObjectFromArray, formatSafeData } from "../components/Utils/functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import moment from "moment";

const rpc = "https://alfajores-forno.celo-testnet.org";

//public client to talk to the
const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport: http(rpc),
});

const useAuthentication = () => {
  const [buttonLoading, setButtonLoading] = useState(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const getUserStatistics = async () => {
    setButtonLoading(true);
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });
      //get the address of the logged in user
      let [address] = await walletClient.getAddresses();
      //get the balance of the logged in user

      const [balance, mySafes, allCommSafes] = await Promise.all([
        await publicClient.readContract({
          address: cUSDContractAddress,
          abi: CUSDAbi,
          functionName: "balanceOf",
          args: [address],
        }),
        await publicClient.readContract({
          address: CeloVestContractAddress,
          abi: CeloVestAbi,
          account: address,
          functionName: "getMySafes",
        }),
        await publicClient.readContract({
          address: CeloVestContractAddress,
          abi: CeloVestAbi,
          functionName: "getTotalCommunityProjects",
        }),
      ]);

      //get all the community safe details
      var details = [];
      var tokenHoldings = []

      for (let i = 0; i < allCommSafes; i++) {
        
           const results = await publicClient.readContract({
            address: CeloVestContractAddress,
            abi: CeloVestAbi,
            functionName: "getCommDetails",
            args: [i],
          });
         const tknHolders =await publicClient.readContract({
            address: CeloVestContractAddress,
            abi: CeloVestAbi,
            functionName: "getIndivTokenHoldings",
            args: [i],
          })
        console.log("token holders :", tknHolders);
        console.log("fres sh :", results);
        details.push({
          id: i,
          title: results[0],
          description: results[1],
          target: results[2],
          currentAmount: results[3],
          isActive: results[4],
          members: results[5],
          communityAdmin: results[6],
          newRequests: results[7],
        });
        tokenHoldings= [...tknHolders]
      }

      let balanceInEthers = formatEther(balance);
     const fomrHolders = tokenHoldings.length > 0 && createObjectFromArray(tokenHoldings[0], tokenHoldings[1]) 
      if(details.length > 0)details[0].tokenHolders = fomrHolders
      const safeData = formatSafeData(mySafes);
      console.log("all user safes :", mySafes, balanceInEthers,fomrHolders);
      console.log("community details :", details,safeData);
      console.log("user address :", address);
      queryClient.setQueryData(["userBalance"], balanceInEthers);
      queryClient.setQueryData(["userAddress"], address);

      queryClient.setQueryData(["userSafes"], mySafes);
      queryClient.setQueryData(["communitySafes"], details);
      setButtonLoading(false);
      navigate("dashboard");
    }
  };

  const LoginButton = () => {
    return (
      <>
        {buttonLoading ? (
          <ClipLoader color="lightblue" />
        ) : (
          <button
            onClick={getUserStatistics}
            className="bg-[#173F8A] text-white font-bold py-3 px-2 rounded-full flex items-center justify-center w-full hover:bg-[#9FB7FF] focus:outline-none focus:ring-2 focus:ring-[#FFC466] focus:ring-opacity-50"
          >
            <FaWallet color="orange" className="mr-2" />
            Login with Wallet
          </button>
        )}
      </>
    );
  };

  const createCommunityGoal = async (data) => {
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });

      let [address] = await walletClient.getAddresses();

      let results = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "createNewCommunitySavingCampaign",
        args: [data.title, data.description, new BigNumber(data.goal * 1e18)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: results,
      });

      console.log("new comm cam res :", receipt);
      return results;
    }
  };

  const createPersonalGoal = async (data) => {
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });

      let [address] = await walletClient.getAddresses();
      const formatedDate = moment(data.date).valueOf();
      const _amount = new BigNumber(data.amount * 1e18);


      console.log("big int :", data,_amount,formatedDate);
      //approve the contract to deduct the amount
      const appRes = await walletClient.writeContract({
        address: cUSDContractAddress,
        abi: CUSDAbi,
        account: address,
        functionName: "approve",
        args: [CeloVestContractAddress, new BigNumber(data.amount * 1e18)],
      });



      let newSafeResults = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "createSafe",
        args: [data.name, _amount, formatedDate],
      });
      console.log("new safe results :", newSafeResults);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newSafeResults,
      });

      console.log("new personal safe res :", receipt);
      return receipt;
    }
  };

  const bal = useQuery({
    queryKey: ["userBalance"],
    queryFn: () => loadUserBalance(),
  });

  const loadUserBalance = async () => {
    setButtonLoading(true);
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });
      //get the address of the logged in user
      let [address] = await walletClient.getAddresses();
      //get the balance of the logged in user

      let balance = await publicClient.readContract({
        address: cUSDContractAddress,
        abi: CUSDAbi,
        functionName: "balanceOf",
        args: [address],
      });

      let balanceInEthers = formatEther(balance);
      queryClient.setQueryData(["userBalance"], balanceInEthers);
      setButtonLoading(false);
      return balanceInEthers;
    }
  };

  const pm = useQuery({
    queryKey: ["userSafes"],
    queryFn: () => loadPersonalSafes(),
  });

  const loadPersonalSafes=async ()=>{

    if (typeof window !== "undefined" && window.ethereum) {

      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });
      //get the address of the logged in user
      let [address] = await walletClient.getAddresses();
      //get the balance of the logged in user

      let res = await publicClient.readContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account:address,
        functionName: "getMySafes",
      })
      let formatedSafes = formatSafeData(res);
      console.log("formated personal safes from query:", formatedSafes);
      queryClient.setQueryData(["userSafes"], formatedSafes);
      return formatedSafes
    }
  }
  const comm = useQuery({
    queryKey: ["communitySafes"],
    queryFn: () => loadCommunitySafes(),
  });

  const loadCommunitySafes = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      let res = await publicClient.readContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        functionName: "getTotalCommunityProjects",
      });

      var details = [];
      var tokenHoldings = []
      for (let i = 0; i < res; i++) {
        const results = await await publicClient.readContract({
          address: CeloVestContractAddress,
          abi: CeloVestAbi,
          functionName: "getCommDetails",
          args: [i],
        })
        const tknHolders =await publicClient.readContract({
          address: CeloVestContractAddress,
          abi: CeloVestAbi,
          functionName: "getIndivTokenHoldings",
          args: [i],
        })

        console.log("fres sh :", results);
        details.push({
          id: i,
          title: results[0],
          description: results[1],
          target: results[2],
          currentAmount: results[3],
          isActive: results[4],
          members: results[5],
          communityAdmin: results[6],
          newRequests: results[7],
        });
        console.log("wewwww :",tknHolders);
        tokenHoldings= [...tknHolders]
      }
      const fomrHolders = createObjectFromArray(tokenHoldings[0], tokenHoldings[1]) 
      details[0].tokenHolders = fomrHolders


      console.log("community safes from query :", details);
      queryClient.setQueryData(["communitySafes"], details);
      return details;
    } 
  };

  async function invalidateCommunitySafes() {
    await queryClient.invalidateQueries(["communitySafes"]);
  }

  async function invalidatePesonalSafes() {
    await queryClient.invalidateQueries(["userSafes"]);
  }

  async function invalidateUserBalance() {
    await queryClient.invalidateQueries(["userBalance"]);
  }

  const approveUserRequest = async (data) => {
    console.log("dddd")
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });

      let [address] = await walletClient.getAddresses();

      let results = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "approveMemberToCommunity",
        args: [data.community_id,data.user],
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: results,
      });

      console.log("new comm cam res :", receipt);
      return results;
    }
  };



  const denyUserRequest = async (data) => {
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });

      let [address] = await walletClient.getAddresses();

      let results = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "denyMemberToCommunity",
        args: [data.community_id,data.user],
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: results,
      });

      console.log("new comm cam res :", receipt);
      return results;
    }
  };


  const createCommunityContribution = async (data) => {
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });

      let [address] = await walletClient.getAddresses();
      const _amount = new BigNumber(data.amount * 1e18);


      //approve the contract to deduct the amount
      const appRes = await walletClient.writeContract({
        address: cUSDContractAddress,
        abi: CUSDAbi,
        account: address,
        functionName: "approve",
        args: [CeloVestContractAddress, _amount],
      });



      let newSafeResults = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "contributeToCommunityFund",
        args: [data.community_id,_amount],
      });
      console.log("new safe results :", newSafeResults);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newSafeResults,
      });

      console.log("new personal safe res :", receipt);
      return receipt;
    }
  };

  const addFundsToSafe = async (data) => {
    if (typeof window !== "undefined" && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celoAlfajores,
      });
      
      let [address] = await walletClient.getAddresses();
      const _amount = new BigNumber(data.amount * 1e18);
      
      console.log("ddddddd :",data,_amount)

      //approve the contract to deduct the amount
      const appRes = await walletClient.writeContract({
        address: cUSDContractAddress,
        abi: CUSDAbi,
        account: address,
        functionName: "approve",
        args: [CeloVestContractAddress, _amount],
      });



      let newSafeResults = await walletClient.writeContract({
        address: CeloVestContractAddress,
        abi: CeloVestAbi,
        account: address,
        functionName: "topUpSafe",
        args: [data.safeId,_amount],
      });
      console.log("new safe results :", newSafeResults);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: newSafeResults,
      });

      console.log("new personal safe res :", receipt);
      return receipt;
    }
  };
  return {
    LoginButton,
    createCommunityGoal,
    createPersonalGoal,
    invalidateCommunitySafes,
    invalidateUserBalance,
    invalidatePesonalSafes,
    approveUserRequest,
    denyUserRequest,
    createCommunityContribution,
    addFundsToSafe
  };
};

export default useAuthentication;
