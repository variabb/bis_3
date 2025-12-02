/**
 * Функція для шифрування книжковим шифром
 * @param {string} keyText - Ключовий текст (книга)
 * @param {string} jsonInput - JSON рядок з повідомленням
 * @returns {string} - JSON рядок з шифротекстом
 */
function encryptBookCipher(keyText, jsonInput) {
  try {
    // Парсинг JSON
    const inputObj = JSON.parse(jsonInput);
    if (!inputObj.message || typeof inputObj.message !== "string") {
      throw new Error('Некоректний JSON: очікується поле "message" з рядком');
    }

    const message = inputObj.message;

    // Перевірка наявності ключа
    if (!keyText || keyText.trim().length === 0) {
      throw new Error("Ключовий текст не може бути порожнім");
    }

    // Розбиття ключа на рядки
    const lines = keyText.split("\n");

    // Створення масиву для зберігання координат символів
    const cipher = [];

    // Для кожного символу повідомлення
    for (let i = 0; i < message.length; i++) {
      const char = message[i];
      let found = false;

      // Пошук першого входження символу в ключі
      for (let row = 0; row < lines.length; row++) {
        const line = lines[row];
        const col = line.indexOf(char);

        if (col !== -1) {
          // Знайдено символ! Координати: row+1 (бо нумерація з 1), col+1
          const rowNum = row + 1;
          const colNum = col + 1;

          // Перетворення координат у двійковий вигляд (8 біт кожна)
          const rowBits = rowNum.toString(2).padStart(8, "0");
          const colBits = colNum.toString(2).padStart(8, "0");

          // Склеювання: rowBits + colBits → 16-бітна адреса
          const address = rowBits + colBits;
          cipher.push(address);
          found = true;
          break; // Знайдено перше входження, переходимо до наступного символу
        }
      }

      if (!found) {
        throw new Error(`Символ "${char}" не знайдено в ключі`);
      }
    }

    // Повернення результату у форматі JSON
    return JSON.stringify({ cipher: cipher }, null, 2);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Некоректний JSON: " + error.message);
    }
    throw error;
  }
}

/**
 * Функція для розшифрування книжкового шифру
 * @param {string} keyText - Ключовий текст (книга)
 * @param {string} jsonInput - JSON рядок з шифротекстом
 * @returns {string} - JSON рядок з розшифрованим повідомленням
 */
function decryptBookCipher(keyText, jsonInput) {
  try {
    // Парсинг JSON
    const inputObj = JSON.parse(jsonInput);
    if (!inputObj.cipher || !Array.isArray(inputObj.cipher)) {
      throw new Error('Некоректний JSON: очікується поле "cipher" з масивом');
    }

    const cipher = inputObj.cipher;

    // Перевірка наявності ключа
    if (!keyText || keyText.trim().length === 0) {
      throw new Error("Ключовий текст не може бути порожнім");
    }

    // Розбиття ключа на рядки
    const lines = keyText.split("\n");

    // Масив для зберігання розшифрованих символів
    const message = [];

    // Для кожної 16-бітної адреси
    for (let i = 0; i < cipher.length; i++) {
      const address = cipher[i];

      // Перевірка формату адреси
      if (typeof address !== "string" || address.length !== 16) {
        throw new Error(
          `Некоректна адреса: "${address}". Очікується 16-бітний рядок`
        );
      }

      // Перевірка, що адреса містить тільки 0 та 1
      if (!/^[01]+$/.test(address)) {
        throw new Error(
          `Некоректна адреса: "${address}". Має містити тільки 0 та 1`
        );
      }

      // Розділення на rowBits (перші 8 біт) та colBits (наступні 8 біт)
      const rowBits = address.substring(0, 8);
      const colBits = address.substring(8, 16);

      // Перетворення з двійкового у десяткове
      const row = parseInt(rowBits, 2);
      const col = parseInt(colBits, 2);

      // Перевірка координат (нумерація з 1)
      if (row < 1 || row > lines.length) {
        throw new Error(
          `Координата поза межами ключа: рядок ${row} (всього рядків: ${lines.length})`
        );
      }

      const line = lines[row - 1]; // row-1 бо масив індексується з 0
      if (col < 1 || col > line.length) {
        throw new Error(
          `Координата поза межами ключа: позиція ${col} в рядку ${row} (довжина рядка: ${line.length})`
        );
      }

      // Взяття символу з ключа за координатами
      const char = line[col - 1]; // col-1 бо масив індексується з 0
      message.push(char);
    }

    // Збір символів у повідомлення
    const decryptedMessage = message.join("");

    // Повернення результату у форматі JSON
    return JSON.stringify({ message: decryptedMessage }, null, 2);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Некоректний JSON: " + error.message);
    }
    throw error;
  }
}

/**
 * Обробник кнопки Encrypt
 */
function handleEncrypt() {
  const keyText = document.getElementById("keyText").value;
  const jsonInput = document.getElementById("jsonInput").value;
  const resultTextarea = document.getElementById("result");

  try {
    if (!keyText.trim()) {
      throw new Error("Введіть ключовий текст");
    }
    if (!jsonInput.trim()) {
      throw new Error("Введіть JSON-повідомлення");
    }

    const result = encryptBookCipher(keyText, jsonInput);
    resultTextarea.value = result;
    resultTextarea.classList.remove("error");
  } catch (error) {
    resultTextarea.value = "Помилка: " + error.message;
    resultTextarea.classList.add("error");
  }
}

/**
 * Обробник кнопки Decrypt
 */
function handleDecrypt() {
  const keyText = document.getElementById("keyText").value;
  const jsonInput = document.getElementById("jsonInput").value;
  const resultTextarea = document.getElementById("result");

  try {
    if (!keyText.trim()) {
      throw new Error("Введіть ключовий текст");
    }
    if (!jsonInput.trim()) {
      throw new Error("Введіть JSON з шифротекстом");
    }

    const result = decryptBookCipher(keyText, jsonInput);
    resultTextarea.value = result;
    resultTextarea.classList.remove("error");
  } catch (error) {
    resultTextarea.value = "Помилка: " + error.message;
    resultTextarea.classList.add("error");
  }
}
