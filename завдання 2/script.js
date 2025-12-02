// ============================================================================
// СУЧАСНИЙ КНИЖКОВИЙ ШИФР
// ============================================================================

// Глобальні змінні для зберігання ключових файлів
let keyFiles = [];

// ============================================================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ============================================================================

/**
 * Конвертує ArrayBuffer в Uint8Array
 */
function bufferToUint8Array(buffer) {
  return new Uint8Array(buffer);
}

/**
 * Конвертує Uint8Array в бітовий рядок (рядок з '0' та '1')
 */
function bytesToBits(bytes) {
  let bits = "";
  for (let i = 0; i < bytes.length; i++) {
    // Конвертуємо кожен байт у 8-бітний рядок
    bits += bytes[i].toString(2).padStart(8, "0");
  }
  return bits;
}

/**
 * Конвертує бітовий рядок назад у Uint8Array
 */
function bitsToBytes(bits) {
  const bytes = [];
  // Розбиваємо на блоки по 8 біт
  for (let i = 0; i < bits.length; i += 8) {
    const byteStr = bits.substr(i, 8);
    bytes.push(parseInt(byteStr, 2));
  }
  return new Uint8Array(bytes);
}

/**
 * Обчислює SHA-256 хеш для ArrayBuffer
 * Повертає hex-рядок
 */
async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Конвертує текст UTF-8 в ArrayBuffer
 */
function textToArrayBuffer(text) {
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

/**
 * Конвертує ArrayBuffer в текст UTF-8
 */
function arrayBufferToText(buffer) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

/**
 * Розбиває бітовий рядок на блоки по k біт
 * Останній блок доповнюється нулями до k біт
 * Повертає масив блоків та кількість блоків
 */
function splitIntoBlocks(bits, k) {
  const blocks = [];
  for (let i = 0; i < bits.length; i += k) {
    let block = bits.substr(i, k);
    // Доповнюємо останній блок нулями до k біт
    if (block.length < k) {
      block = block.padEnd(k, "0");
    }
    blocks.push(block);
  }
  return blocks;
}

/**
 * Показує повідомлення про статус
 */
function showStatus(message, isError = false) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = "status " + (isError ? "error" : "success");
  setTimeout(() => {
    statusEl.className = "status";
    statusEl.textContent = "";
  }, 5000);
}

// ============================================================================
// ЗБИРАННЯ КЛЮЧОВИХ ФАЙЛІВ
// ============================================================================

/**
 * Збирає ключові файли з input file або textarea
 * Повертає Promise з масивом об'єктів {id, name, buffer, sha256}
 */
async function collectKeyFiles() {
  const files = [];
  const fileInput = document.getElementById("keyFilesInput");
  const textarea1 = document.getElementById("textareaFile1");
  const textarea2 = document.getElementById("textareaFile2");
  const textarea3 = document.getElementById("textareaFile3");

  // Перевіряємо, чи є прикріплені файли
  if (fileInput.files && fileInput.files.length > 0) {
    // Використовуємо прикріплені файли
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      const buffer = await file.arrayBuffer();
      const sha256 = await computeSHA256(buffer);

      files.push({
        id: i + 1,
        name: file.name,
        buffer: buffer,
        sha256: sha256,
      });
    }
  } else {
    // Використовуємо textarea fallback
    const textareas = [textarea1, textarea2, textarea3];
    for (let i = 0; i < textareas.length; i++) {
      const text = textareas[i].value.trim();
      if (text) {
        const buffer = textToArrayBuffer(text);
        const sha256 = await computeSHA256(buffer);

        files.push({
          id: i + 1,
          name: `textarea-${i + 1}.txt`,
          buffer: buffer,
          sha256: sha256,
        });
      }
    }
  }

  // Перевірка: потрібно мінімум 2 файли
  if (files.length < 2) {
    throw new Error(
      "Потрібно мінімум 2 ключових файли (або прикріпіть файли, або введіть текст у textarea)"
    );
  }

  if (files.length > 5) {
    throw new Error("Максимум 5 ключових файлів");
  }

  return files;
}

// ============================================================================
// ПОБУДОВА ІНДЕКСУ
// ============================================================================

/**
 * Будує індекс блоків для всіх ключових файлів
 * Повертає об'єкт: {block_value: [[file_id, block_id], ...]}
 */
function buildIndex(keyFiles, k) {
  const index = {};

  // Проходимо по кожному файлу
  for (const file of keyFiles) {
    const bytes = bufferToUint8Array(file.buffer);
    const bits = bytesToBits(bytes);
    const blocks = splitIntoBlocks(bits, k);

    // Для кожного блоку додаємо адресу в індекс
    for (let blockId = 0; blockId < blocks.length; blockId++) {
      const blockValue = blocks[blockId];

      if (!index[blockValue]) {
        index[blockValue] = [];
      }

      // block_id починається з 1 (як у вимогах)
      index[blockValue].push([file.id, blockId + 1]);
    }
  }

  return index;
}

// ============================================================================
// ШИФРУВАННЯ
// ============================================================================

/**
 * Шифрує повідомлення за допомогою книжкового шифру
 */
async function encrypt() {
  try {
    // Очищаємо вивід
    document.getElementById("jsonOutput").value = "";
    showStatus("");

    // Перевіряємо параметр k
    const k = parseInt(document.getElementById("kInput").value);
    if (isNaN(k) || k <= 0 || k > 32) {
      throw new Error("Параметр k повинен бути числом від 1 до 32");
    }

    // Збираємо ключові файли
    const keyFiles = await collectKeyFiles();

    // Будуємо індекс
    const index = buildIndex(keyFiles, k);

    // Парсимо JSON ввід
    const jsonInput = document.getElementById("jsonInput").value.trim();
    if (!jsonInput) {
      throw new Error("Введіть JSON для шифрування");
    }

    let inputData;
    try {
      inputData = JSON.parse(jsonInput);
    } catch (e) {
      throw new Error("Некоректний JSON формат: " + e.message);
    }

    if (!inputData.message) {
      throw new Error('JSON повинен містити поле "message"');
    }

    const plaintext = inputData.message;

    // Конвертуємо plaintext в біти
    const plaintextBuffer = textToArrayBuffer(plaintext);
    const plaintextBytes = bufferToUint8Array(plaintextBuffer);
    const plaintextBits = bytesToBits(plaintextBytes);
    const originalBitLength = plaintextBits.length;

    // Розбиваємо на k-бітні блоки
    const plaintextBlocks = splitIntoBlocks(plaintextBits, k);

    // Для кожного блоку випадково обираємо адресу з індексу
    const addresses = [];
    for (let i = 0; i < plaintextBlocks.length; i++) {
      const block = plaintextBlocks[i];

      if (!index[block] || index[block].length === 0) {
        throw new Error(`Блок ${block} не знайдено в ключових файлах`);
      }

      // Випадково обираємо одну адресу
      const possibleAddresses = index[block];
      const randomIndex = Math.floor(Math.random() * possibleAddresses.length);
      addresses.push(possibleAddresses[randomIndex]);
    }

    // Формуємо результатний JSON
    const result = {
      KBits: k,
      BitLength: originalBitLength,
      Files: keyFiles.map((file) => {
        const bytes = bufferToUint8Array(file.buffer);
        const bits = bytesToBits(bytes);
        const blocks = splitIntoBlocks(bits, k);

        return {
          Id: file.id,
          Path: file.name,
          Sha256: file.sha256,
          BlocksCount: blocks.length,
        };
      }),
      Addresses: addresses,
    };

    // Виводимо результат
    document.getElementById("jsonOutput").value = JSON.stringify(
      result,
      null,
      2
    );
    showStatus("Шифрування успішно виконано!");
  } catch (error) {
    showStatus("Помилка: " + error.message, true);
    console.error("Помилка шифрування:", error);
  }
}

// ============================================================================
// ДЕШИФРУВАННЯ
// ============================================================================

/**
 * Дешифрує повідомлення за допомогою книжкового шифру
 */
async function decrypt() {
  try {
    // Очищаємо вивід
    document.getElementById("jsonOutput").value = "";
    showStatus("");

    // Парсимо JSON ввід
    const jsonInput = document.getElementById("jsonInput").value.trim();
    if (!jsonInput) {
      throw new Error("Введіть JSON для дешифрування");
    }

    let inputData;
    try {
      inputData = JSON.parse(jsonInput);
    } catch (e) {
      throw new Error("Некоректний JSON формат: " + e.message);
    }

    // Перевіряємо структуру JSON
    if (
      !inputData.KBits ||
      !inputData.BitLength ||
      !inputData.Files ||
      !inputData.Addresses
    ) {
      throw new Error(
        "JSON повинен містити поля: KBits, BitLength, Files, Addresses"
      );
    }

    const k = inputData.KBits;
    const bitLength = inputData.BitLength;
    const filesInfo = inputData.Files;
    const addresses = inputData.Addresses;

    // Перевіряємо параметр k
    if (isNaN(k) || k <= 0 || k > 32) {
      throw new Error("KBits повинен бути числом від 1 до 32");
    }

    // Збираємо ключові файли
    const keyFiles = await collectKeyFiles();

    // Перевіряємо SHA-256 хеші
    for (const fileInfo of filesInfo) {
      const keyFile = keyFiles.find((f) => f.id === fileInfo.Id);
      if (!keyFile) {
        throw new Error(
          `Файл з Id=${fileInfo.Id} не знайдено серед ключових файлів`
        );
      }

      if (keyFile.sha256 !== fileInfo.Sha256) {
        throw new Error(
          `Файл з Id=${fileInfo.Id} (${fileInfo.Path}) не відповідає хешу SHA-256. Очікувано: ${fileInfo.Sha256}, отримано: ${keyFile.sha256}`
        );
      }
    }

    // Будуємо мапу блоків для швидкого доступу
    // Структура: blocksMap[file_id][block_id] = block_value
    const blocksMap = {};

    for (const file of keyFiles) {
      const bytes = bufferToUint8Array(file.buffer);
      const bits = bytesToBits(bytes);
      const blocks = splitIntoBlocks(bits, k);

      blocksMap[file.id] = {};
      for (let i = 0; i < blocks.length; i++) {
        // block_id починається з 1
        blocksMap[file.id][i + 1] = blocks[i];
      }
    }

    // Відновлюємо біти за адресами
    let decryptedBits = "";
    for (const address of addresses) {
      if (!Array.isArray(address) || address.length !== 2) {
        throw new Error(
          "Некоректний формат адреси: " + JSON.stringify(address)
        );
      }

      const [fileId, blockId] = address;

      if (!blocksMap[fileId]) {
        throw new Error(`Файл з Id=${fileId} не знайдено`);
      }

      if (!blocksMap[fileId][blockId]) {
        throw new Error(
          `Блок з Id=${blockId} не знайдено у файлі з Id=${fileId}`
        );
      }

      decryptedBits += blocksMap[fileId][blockId];
    }

    // Обрізаємо до початкової довжини (прибираємо padding)
    if (decryptedBits.length < bitLength) {
      throw new Error(
        `Недостатньо бітів для дешифрування. Очікувано: ${bitLength}, отримано: ${decryptedBits.length}`
      );
    }
    decryptedBits = decryptedBits.substr(0, bitLength);

    // Конвертуємо біти назад у текст
    const decryptedBytes = bitsToBytes(decryptedBits);
    const decryptedBuffer = decryptedBytes.buffer;
    const decryptedText = arrayBufferToText(decryptedBuffer);

    // Формуємо результатний JSON
    const result = {
      message: decryptedText,
    };

    // Виводимо результат
    document.getElementById("jsonOutput").value = JSON.stringify(
      result,
      null,
      2
    );
    showStatus("Дешифрування успішно виконано!");
  } catch (error) {
    showStatus("Помилка: " + error.message, true);
    console.error("Помилка дешифрування:", error);
  }
}

// ============================================================================
// ПІДКЛЮЧЕННЯ ОБРОБНИКІВ ПОДІЙ
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("encryptBtn").addEventListener("click", encrypt);
  document.getElementById("decryptBtn").addEventListener("click", decrypt);
});
