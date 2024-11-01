// Импортирование необходимых модулей
const express = require('express'); // Express - фреймворк для создания веб-приложений на Node.js
const bodyParser = require('body-parser'); // Модуль для парсинга тела запросов
const cookieParser = require('cookie-parser'); // Модуль для работы с cookie
const session = require('express-session'); // Express Session для обработки сессий
const fs = require('fs'); // Модуль для работы с файловой системой
const cors = require('cors'); // Импортируем пакет cors для разрешения кросс-доменных запросов.
const sqlite3 = require('sqlite3').verbose(); // SQLite3 для работы с базами данных
const morgan = require('morgan'); // Morgan - middleware для логирования HTTP-запросов
const chalk = require('chalk'); // Chalk - библиотека для цветной консоли
const dotenv = require('dotenv'); // dotenv - для загрузки переменных среды
const https = require('https'); // Модуль для поддержки HTTPS
const http = require('http'); // Модуль для работы с HTTP

// Загружаем переменные окружения из .env файла
dotenv.config();

// Настройка логирования с использованием morgan
morgan.token('method', (req) => chalk.blue(req.method)); // Цвет метода запроса
morgan.token('url', (req) => chalk.green(req.url)); // Цвет URL запроса
morgan.token('status', (req, res) => chalk.yellow(res.statusCode)); // Цвет статуса ответа
morgan.token('response-time', (req, res) => chalk.magenta(`${res.get('response-time')} ms`)); // Цвет времени ответа
morgan.token('remote-addr', (req) => chalk.cyan(req.ip)); // Цвет для IP-адреса клиента
morgan.token('user-agent', (req) => chalk.magenta(req.get('User-Agent'))); // Цвет для User-Agent
morgan.token('date', () => chalk.blue(new Date().toISOString())); // Цвет для даты и времени
morgan.token('cookies', (req) => chalk.yellow(JSON.stringify(req.cookies))); // Цвет для cookies
morgan.token('session-id', (req) => chalk.green(req.session.id || 'no session')); // Цвет для session ID
morgan.token('referer', (req) => chalk.cyan(req.get('Referer') || 'no referer')); // Цвет для реферера

const app = express();

// Создаем формат логирования
const loggerFormat = ':date | :remote-addr | :cookies | session ID: :session-id | referer: :referer | :method :url :status';

// Настройка сессий с улучшением безопасности
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Переменная среды для секрета сессии
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Использование безопасных cookie в продакшене
}));

app.use(cors()); // Включаем для разрешения кросс-доменных запросов к серверу.
app.use(bodyParser.json()); // Разбор JSON-запросов
app.use(cookieParser()); // Разбор cookie в запросах
app.use(express.static('public')); // Определение папки 'public' для статических файлов (например, изображения, CSS, JS)
app.use(morgan(loggerFormat)); // Используем morgan как middleware

// Создание базы данных и таблицы заказов
const db = new sqlite3.Database('./orders.db', (err) => {
    if (err) {
        console.log(chalk.red("Ошибка подключения к БД", err)); // Логируем ошибку подключения
    } else {
        console.log(chalk.green("SQLite3 - подключено!")); // Логируем успешное подключение
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            items TEXT,
            total REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Обработка заказа
app.post('/api/place-order', (req, res) => {
    const { items, total } = req.body; // Извлечение данных из тела запроса

    // Валидация входных данных
    if (!Array.isArray(items) || items.length === 0 || typeof total !== 'number') {
        return res.status(400).json({ error: 'Некорректные данные заказа' }); // Проверка входных данных
    }

    db.run(`INSERT INTO orders (items, total) VALUES (?, ?)`, [JSON.stringify(items), total], function (err) {
        if (err) {
            console.log(chalk.red("Ошибка сохранения заказа", err)); // Логируем ошибку сохранения заказа
            return res.status(500).json({ error: 'Ошибка сохранения заказа' }); // Ответ клиенту при ошибке
        }
        console.log(chalk.gray("Заказ успешно сохранен", this.lastID)); // Логируем успешное сохранение заказа
        res.status(201).json({ message: 'Заказ успешно сохранен', orderId: this.lastID }); // Ответ клиенту
    });
});

// Функция для загрузки продуктов из JSON файла
const loadProducts = () => {
    const data = fs.readFileSync('products.json');
    return JSON.parse(data);
};

// Эндпоинт для получения характеристик продукта
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const products = loadProducts();
    const product = products.find(p => p.id === id);
    if (product) {
        console.log(product);
        res.json(product);
    } else {
        res.status(404).send("Продукт не найден.");
    }
});

// Обработка GET-запроса для получения списка товаров
app.get('/api/products', (req, res) => {
    // Чтение файла products.json, содержащего данные о товарах
    fs.readFile('products.json', 'utf-8', (err, data) => {
        if (err) {
            console.log(chalk.red("Ошибка чтения данных о продуктах", err)); // Логируем ошибку чтения
            return res.status(500).send('Ошибка чтения данных о продуктах'); // Ответ клиенту при ошибке
        }
        res.send(data); // Отправляем данные о товарах клиенту
    });
});

// Обработка POST-запроса для обновления рейтинга продукта
app.post('/api/rate', (req, res) => {
    const { productId, rating } = req.body; // Извлечение данных из тела запроса

    // Проверка валидности входных данных
    if (typeof productId !== 'number' || typeof rating !== 'number') {
        return res.status(400).send('Некорректные данные рейтинга'); // Проверка данные
    }

    // Получение идентификатора пользователя из cookie или генерация нового, если он отсутствует
    const userId = req.cookies.userId || generateUniqueUserId();

    // Чтение файла products.json, чтобы получить текущие данные о товарах
    fs.readFile('products.json', 'utf-8', (err, data) => {
        if (err) {
            console.log(chalk.red("Ошибка чтения данных о продуктах", err)); // Логируем ошибку чтения
            return res.status(500).send('Ошибка чтения данных о продуктах'); // Ответ клиенту при ошибке
        }

        const products = JSON.parse(data); // Преобразование данных из JSON-строки в объект JavaScript
        const product = products.find(p => p.id === productId); // Поиск товара по идентификатору

        if (!product) return res.status(404).send('Продукт не найден'); // Если продукт не найден

        // Проверка, голосовал ли пользователь за этот продукт ранее
        if (!req.cookies[`rated_${productId}`]) {
            product.votes++; // Увеличение общего количества голосов
            // Пересчет рейтинга
            product.rating = ((product.rating * (product.votes - 1)) + rating) / product.votes;

            // Запись обновленных данных о товарах обратно в файл
            fs.writeFile('products.json', JSON.stringify(products, null, 2), (err) => { // Форматирование JSON для удобства
                if (err) {
                    console.log(chalk.red("Ошибка сохранения данных о продукте", err)); // Логируем ошибку сохранения данных
                    return res.status(500).send('Ошибка сохранения данных о продукте'); // Ответ клиенту при ошибке
                }

                // Установка cookie, чтобы запомнить, что пользователь уже проголосовал за этот продукт
                res.cookie(`rated_${productId}`, true, { maxAge: 86400 * 1000 }); // Действие cookie 1 сутки
                res.send(product); // Отправка обновленных данных о продукте клиенту
            });
        } else {
            // Если пользователь уже проголосовал, отправляем статус 403 (доступ запрещен)
            res.status(403).send('Пользователь уже проголосовал за этот продукт');
        }
    });
});

// Получаем режим из переменных окружения
const env = process.env.NODE_ENV || 'development';
const httpPort = process.env.HTTP_PORT || 3000;
const httpsPort = process.env.HTTPS_PORT || 443;

// Запуск HTTPS сервера для production
if (env === 'production') {
    const httpsOptions = {
        key: fs.readFileSync(process.env.HTTPS_KEY_PATH), // Читаем приватный ключ
        cert: fs.readFileSync(process.env.HTTPS_CERT_PATH) // Читаем сертификат
    };

    https.createServer(httpsOptions, app).listen(httpsPort, () => {
        console.log(chalk.green(`HTTPS сервер запущен на порту ${httpsPort}`)); // Логируем запуск сервера
    });
} else { // Запуск HTTP сервера для разработки
    http.createServer(app).listen(httpPort, () => {
        console.log(chalk.green(`HTTP сервер запущен на порту ${httpPort}`)); // Логируем запуск сервера
    });
}

// Функция для генерации уникального идентификатора пользователя
function generateUniqueUserId() {
    return `user_${new Date().getTime()}`; // Создание уникального идентификатора на основе текущего времени
}