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

let port;
let reading = false;
let reader;

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

document
  .getElementById("sendMessageBtn")
  .addEventListener("click", async () => {
    const message = document.getElementById("serialMessage").value;
    sendMessage(message);
  });
document
  .getElementById("serialMessage")
  .addEventListener("keypress", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const message = document.getElementById("serialMessage").value;
    sendMessage(message);
  });

async function sendMessage(message) {
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

// 模拟接收串口数据并显示在终端
function receiveSerialData(data) {
  serialTerminal.value += data + "\n";
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
    console.error("串口不可读取");
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
          console.log("串口读取完成");
          break;
        }
        const decodedData = decoder.decode(value);
        receiveSerialData(decodedData);
      } catch (error) {
        console.error("读取串口数据时出错:", error);
        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("串口读取过程中发生严重错误:", error);
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
