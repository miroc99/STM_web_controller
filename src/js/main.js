import USBJson from "/assets/usb-device.json";
import "../scss/style.scss";

import * as bootstrap from "bootstrap";

const requestPortBtn = document.getElementById("requestPortBtn");
const baudRateSelect = document.getElementById("baudRateSelect");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const selectedPort = document.getElementById("selectedPort");
const portInfo = document.getElementById("portInfo");
const serialTerminal = document.getElementById("serialTerminal");
const refreshBtn = document.getElementById("refreshButton");

let port;
let reading = false;
let reader;
let currentRecvData = "";
disconnectBtn.disabled = true;
connectBtn.addEventListener("click", async () => {
  try {
    // 檢查是否已經選擇序列埠
    if (!port) {
      throw new Error("請先選擇序列埠");
    }

    // 選中的波特率
    const baudRate = parseInt(baudRateSelect.value);
    if (isNaN(baudRate)) {
      throw new Error("請選擇有效的Baud Rate");
    }

    // 打開序列埠
    await port.open({ baudRate: baudRate });

    console.log("序列埠連接成功");
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    selectedPort.textContent = `已連接到 ${getReadableVIDPIDString()}`;
    startRead();
  } catch (error) {
    console.error("連接序列埠時出錯:", error);
    alert(`連接失敗: ${error.message}`);
  }
});

// 請求選擇序列埠
requestPortBtn.addEventListener("click", async () => {
  try {
    port = await navigator.serial.requestPort();
    console.log("已選擇序列埠:", getDeviceName(port));
    selectedPort.textContent = `已選擇 ${getDeviceName(
      port
    )} ${getReadableVIDPIDString()}`;
  } catch (error) {
    console.error("選擇序列埠時出錯:", error);
    alert("選擇序列埠失敗");
  }
});

// 中斷連線
disconnectBtn.addEventListener("click", async () => {
  if (port && port.readable) {
    reading = false;
    reader.cancel(); // Release the lock
    await new Promise((resolve) => setTimeout(resolve, 100)); // Give some time for the loop to exit
    await port.close();
    console.log("序列埠連接已斷開");
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    selectedPort.textContent = "未連接";
  }
});

// 刷新 Motor 資訊
refreshBtn.addEventListener("click", async () => {
  getMotorInfo();
});

document.getElementById("seekHomeBtn").addEventListener("click", seekHome);
document.getElementById("setZeroBtn").addEventListener("click", async () => {
  await seekZero();
  await getMotorInfo();
});
document
  .getElementById("sendMessageBtn")
  .addEventListener("click", async () => {
    const messageInput = document.getElementById("serialMessage");
    sendMessage(messageInput.value, false);
    messageInput.value = "";
  });
document
  .getElementById("serialMessage")
  .addEventListener("keypress", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const messageInput = document.getElementById("serialMessage");
    sendMessage(messageInput.value, false);
    messageInput.value = "";
  });

async function sendMessage(message, waitResponse = false) {
  if (port && port.writable) {
    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    const data = encoder.encode(message + "\r");
    try {
      await writer.write(data);
      console.log("訊息已成功傳送");
    } catch (error) {
      console.error("傳送訊息時出錯:", error);
      alert("傳送訊息失敗");
    } finally {
      writer.releaseLock();
    }
  } else {
    console.error("序列埠未連接或不可寫入");
    alert("請先連接序列埠");
  }
  console.log("發送訊息:", message);
  // printToSerialTerminal(message, false);
  if (waitResponse) return await waitForResponse();
}
function waitForResponse(timeout = 2000) {
  return new Promise((resolve, reject) => {
    let startTime = Date.now();

    function checkResponse() {
      if (currentRecvData) {
        let response = currentRecvData;
        currentRecvData = ""; // 清空以準備接收下一個回應
        resolve(response);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("等待回應超時"));
      } else {
        setTimeout(checkResponse, 100); // 每 100ms 檢查一次
      }
    }

    checkResponse();
  });
}
function getReadableVIDPIDString() {
  return `VID=${getVID()} PID=${getPID()}`;
}
function getVID() {
  return `${port.getInfo().usbVendorId.toString(16).toUpperCase()}`;
}
function getPID() {
  return `${port.getInfo().usbProductId.toString(16).toUpperCase()}`;
}

// 模擬接收序列埠資料
function printToSerialTerminal(data, isRecv = true) {
  serialTerminal.value = serialTerminal.value.slice(0, -1); // 移除最後一個換行符
  currentRecvData += data.trim(); // 累積回應
  serialTerminal.value += data + "\r";
  serialTerminal.scrollTop = serialTerminal.scrollHeight;
}

// 清除终端内容
document
  .getElementById("clearTerminalBtn")
  .addEventListener("click", function () {
    serialTerminal.value = "";
  });

async function startRead() {
  if (!port || !port.readable) {
    console.error("序列埠不可讀取");
    return;
  }

  reader = port.readable.getReader();
  const decoder = new TextDecoder();
  reading = true;
  try {
    while (reading) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          console.log("序列埠讀取完成");
          break;
        }
        const decodedData = decoder.decode(value);
        console.log("接收資料:", decodedData);
        printToSerialTerminal(decodedData);
      } catch (error) {
        console.error("讀取序列埠時出錯:", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("序列埠讀取過程中發生嚴重錯誤:", error);
  } finally {
    reader.releaseLock();
    console.log("end");
  }
}

function getDeviceName(port) {
  if (!port) return undefined;
  const { usbProductId, usbVendorId } = port.getInfo();
  if (!usbVendorId) return undefined;
  const vendor = USBJson[usbVendorId.toString(16).padStart(4, "0")];
  if (!vendor) return undefined;
  const product = vendor.devices[usbProductId.toString(16).padStart(4, "0")];
  console.debug("getDeviceName", product ? product.name : undefined);
  return product ? product.devname : undefined;
}

function seekHome() {
  sendMessage("SH3F", false);
}
async function seekZero() {
  await sendMessage("EP0", false);
  await sendMessage("SP0", false);
}
// Motor Function
async function getMotorInfo() {
  try {
    let response;

    response = await sendMessage("RV", true);
    document.getElementById("motorModelAndFirmware").value =
      extractValue(response);
    console.log("馬達型號與韌體:", response);

    response = await sendMessage("DA", true);
    document.getElementById("motorAddress").value = extractValue(response);
    console.log("馬達地址:", response);

    response = await sendMessage("SP", true);
    document.getElementById("motorPosition").value = extractValue(response);
    console.log("馬達位置:", response);

    response = await sendMessage("IT", true);
    document.getElementById("motorTemp").value = extractValue(response) / 10;
    console.log("馬達溫度:", response);

    response = await sendMessage("IS", true);
    document.getElementById("motorIO").value = extractValue(response);
    console.log("馬達 I/O:", response);

    response = await sendMessage("IU", true);
    document.getElementById("motorVoltage").value = extractValue(response) / 10;
    console.log("馬達電壓:", response);

    response = await sendMessage("JS", true);
    document.getElementById("motorJogSpeed").value = extractValue(response);
    console.log("馬達 Jog 速度:", response);

    response = await sendMessage("JA", true);
    document.getElementById("motorJogAccel").value = extractValue(response);
    console.log("馬達 Jog 加速度:", response);

    response = await sendMessage("JL", true);
    document.getElementById("motorJogDecel").value = extractValue(response);
    console.log("馬達 Jog 減速度:", response);

    response = await sendMessage("VE", true);
    document.getElementById("motorMoveSpeed").value = extractValue(response);
    console.log("馬達移動速度:", response);

    response = await sendMessage("AC", true);
    document.getElementById("motorMoveAccel").value = extractValue(response);
    console.log("馬達移動加速度:", response);

    response = await sendMessage("DE", true);
    document.getElementById("motorMoveDecel").value = extractValue(response);
    console.log("馬達移動減速度:", response);

    response = await sendMessage("DI", true);
    document.getElementById("motorMoveDirection").value =
      extractValue(response);
    console.log("馬達方向:", response);
  } catch (error) {
    console.error("獲取馬達資訊時發生錯誤:", error);
    alert("獲取馬達資訊失敗: " + error.message);
  }
}

// 取 "=" 之後的值
function extractValue(data) {
  const parts = data.split("=");
  return parts.length > 1 ? parts[1].trim() : data.trim();
}
