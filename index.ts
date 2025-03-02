require("dotenv").config();
const fs = require("fs");
const { Web3 } = require("web3");

// ������ Kết nối với Sahara Testnet
const RPC_URL = "https://testnet.saharalabs.ai";
const web3 = new Web3(RPC_URL);

// ������ Đọc danh sách Private Key từ file `private_keys.txt`
function getPrivateKeys(): string[] {
  try {
    const data: string = fs.readFileSync("/root/sahara/private_keys.txt", "utf8");
    const keys: string[] = data
      .split("\n") // Chia thành từng dòng
      .map((key: string) => key.trim()) // Xóa khoảng trắng
      .filter((key: string) => key !== "") // Lọc dòng trống
      .map((key: string) => (key.startsWith("0x") ? key.slice(2) : key)); // Xóa tiền tố "0x" nếu có

    if (keys.length === 0) {
      console.error("❌ Lỗi: Không tìm thấy bất kỳ PRIVATE_KEY nào!");
      process.exit(1);
    }
    return keys;
  } catch (error) {
    console.error("❌ Lỗi khi đọc private_keys.txt:", error);
    process.exit(1);
  }
}

// ������ Đọc danh sách ví từ `wallets.json`
function getWalletList(): { address: string; amount: string }[] {
  try {
    const data: string = fs.readFileSync("/root/sahara/wallets.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("❌ Lỗi khi đọc wallets.json:", error);
    return [];
  }
}

// ������ Lấy số dư Native Token SAHARA
async function getBalance(address: string): Promise<string> {
  try {
    const balance = await web3.eth.getBalance(address);
    console.log(
      `[Số dư ví: ${address}]:`,
      web3.utils.fromWei(balance, "ether"),
      "SAHARA\n"
    );
    return balance;
  } catch (error) {
    console.error("❌ Lỗi khi lấy số dư:", error);
    return "0";
  }
}

// ������ Gửi Native Token SAHARA từ tất cả Private Keys
async function sendNativeToken(privateKey: string) {
  const ACCOUNT = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);
  await getBalance(ACCOUNT.address);

  const wallets = getWalletList();

  // ������ Nếu Private Key khớp với ví trong danh sách, chỉ gửi về chính nó
  const selfTransaction = wallets.find(
    (w) => w.address.toLowerCase() === ACCOUNT.address.toLowerCase()
  );

  let recipients;
  if (selfTransaction) {
    console.log(`������ Ví ${ACCOUNT.address} có trong danh sách. Gửi về chính nó.`);
    recipients = [{ address: ACCOUNT.address, amount: selfTransaction.amount }];
  } else {
    // ������ Nếu không trùng, gửi theo danh sách `wallets.json`
    recipients = wallets;
  }

  for (let i = 0; i < recipients.length; i++) {
    const recipientAddress = recipients[i].address;
    const amount = web3.utils.toWei(recipients[i].amount, "ether"); // Lấy đúng số lượng từ file
    const nonce = await web3.eth.getTransactionCount(ACCOUNT.address);
    const gasPrice = await web3.eth.getGasPrice();
    const adjustedGasPrice = BigInt(gasPrice) * 12n / 10n; // Tăng 20%

    const balance = await getBalance(ACCOUNT.address);
    if (BigInt(balance) < BigInt(amount) + adjustedGasPrice * 21000n) {
      console.error(`❌ Không đủ số dư để gửi ${web3.utils.fromWei(amount, "ether")} SAHARA`);
      continue;
    }

    // ������ Tạo giao dịch gửi Native Token SAHARA
    const tx = {
      from: ACCOUNT.address,
      to: recipientAddress,
      value: amount,
      gas: 21000,
      gasPrice: adjustedGasPrice,
    };

    try {
      // ������ Ký và gửi giao dịch
      const signedTx = await web3.eth.accounts.signTransaction(tx, "0x" + privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log(
        `✅ Giao dịch ${i + 1}/${recipients.length} thành công! ${web3.utils.fromWei(
          amount,
          "ether"
        )} SAHARA gửi đến: ${recipientAddress} (nonce: ${nonce}), tx: `,
        receipt.transactionHash
      );
    } catch (error) {
      console.error(`❌ Lỗi khi gửi giao dịch ${i + 1}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000)); // Đợi 10 giây giữa mỗi giao dịch
  }

  console.log(`✅ Hoàn thành gửi token SAHARA từ ví ${ACCOUNT.address}\n`);
  await getBalance(ACCOUNT.address);
}

// ������ Chạy lặp lại cho tất cả Private Keys
async function runWithRandomDelay() {
  const PRIVATE_KEYS = getPrivateKeys(); // Lấy danh sách Private Key từ file

  for (const privateKey of PRIVATE_KEYS) {
    await sendNativeToken(privateKey);
  }

  const randomDelay = (5 + Math.random() * 5) * 60 * 1000; // Random từ 5 đến 10 phút
  console.log(
    `============= ĐỢI ${randomDelay / 1000 / 60} PHÚT CHẠY LẠI...==============\n\n`
  );
  setTimeout(runWithRandomDelay, randomDelay);
}

// ������ Khởi chạy chương trình
runWithRandomDelay();
