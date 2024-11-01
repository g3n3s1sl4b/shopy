// Ждем, когда вся страница будет загружена и готова к взаимодействию
$(document).ready(function () {

// Обновляем количество товаров в корзине при загрузке страницы
updateCartCount();

const PRODUCT_URL = "/api/products"; // URL для получения списка продуктов
const RATE_URL = "/api/rate"; // URL для отправки рейтинга продукта
const cart = JSON.parse(localStorage.getItem('cart')) || []; // Загружаем корзину из localStorage или инициализируем пустым массивом

// Загрузка списка продуктов с сервера
$.get(PRODUCT_URL, function (data) {
        const products = JSON.parse(data); // Парсим полученные данные из JSON
        displayProducts(products); // Отображаем продукты на странице
});

// Обработчик нажатия кнопки "Оформить заказ"
$('#place-order').on('click', function (event) {

        // Предотвращение отправки формы по умолчанию
        event.preventDefault();

        const form = document.getElementById('orderForm');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');

        // Получаем значения из полей ввода
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;

        // Очищаем сообщение об ошибке
        errorMessage.textContent = '';
        successMessage.textContent = '';

        // Проверяем валидацию
        let valid = true;

        if (!validateEmail(email)) {
            errorMessage.textContent += 'Неправильный адрес электронной почты.\n';
            valid = false;
        }

        if (!validatePhone(phone)) {
            errorMessage.textContent += 'Неправильный номер телефона. Используйте формат: +1234567890.\n';
            valid = false;
        }

        // Если данные валидны, отправляем форму
        if (valid) {
            // Здесь вы можете добавить логику отправки заказа, например, с использованием Fetch API
            console.log('Данные валидные:', { name, email, phone });
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            const orderData = { items: cart, total: calculateTotal(cart) };
            // Отправляем заказ на сервер
            $.ajax({
                type: "POST",
                url: "/api/place-order", // URL вашего сервера для обработки заказа
                contentType: "application/json",
                data: JSON.stringify(orderData),
                success: function (response) {
                    // Если заказ успешен, показываем сообщение
                    console.log(response);
                    $('#successMessage').text(`Заказ ${response.orderId} успешно отправлен!`);
                    localStorage.removeItem('cart'); // Очищаем корзину 
                    updateCartCount(); // Обновляем счетчик до  0
                    // form.reset(); // Очищаем форму
                },
                error: function (error) {
                    alert(response.message);
                }
            });
        };


});

// Обработчик нажатия на иконку корзины
$('#cart-icon').on('click', function () {
    displayCart();
});

// Функция для отображения корзины
function displayCart() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartItems = $('#cart-items');
    cartItems.empty(); // Очистка списка перед заполнением

    let totalPrice = 0;

    // Отображение элементов корзины
    cart.forEach(item => {
        console.log(item);
        cartItems.append(`<li class="list-group-item">${item.name} - $${item.price}</li>`);
        totalPrice += item.price;
    });

    $('#total-price').text(`Всего: $${totalPrice.toFixed(2)}`);

    // Показываем модальное окно
    const cartModal = new bootstrap.Modal(document.getElementById('cart'), { keyboard: false });
    cartModal.show();
}

// Функция для отображения продуктов на странице
function displayProducts(products) {
    $('#product-list').empty(); // Очищаем список продуктов перед добавлением новых
    products.forEach(product => {
        // Формируем HTML-код для каждого продукта
        const productHtml = `
                <div class="col-md-4"> <!-- Колонка для адаптивной разметки -->
                    <div class="card mb-4 shadow-sm"> <!-- Карточка продукта -->
                        <div class="card-body"> <!-- Тело карточки -->
                            <h5 class="card-title">${product.name}</h5> <!-- Название продукта -->
                            <h3 class="card-title">${product.price}</h3> <!-- Цена продукта -->
                            <div class="card-text">
                                ${renderStars(product.rating)} <!-- Отрисовываем звездный рейтинг -->
                                <span>(${product.votes})</span> <!-- Количество голосов -->
                            </div>
                            <!-- Кнопка добавления продукта в корзину -->
                            <button data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" class="btn btn-primary add-to-cart">Добавить в корзину</button>
                        </div>
                    </div>
                </div>
            `;
        $('#product-list').append(productHtml); // Добавляем карточку продукта в список
    });

    // Обработчик событий для звездочного рейтинга
    $('.star').on('click', function (e) {
        const $star = $(e.target); // Получаем нажатую звездочку
        const productId = $star.closest('.card').find('.add-to-cart').data('id'); // Нахождение идентификатора продукта
        const rating = $star.data('value'); // Получаем значение рейтинга звездочки

        // Отправка рейтинга на сервер
        $.ajax({
            url: RATE_URL,
            method: "POST", // Используем метод POST для отправки данных
            contentType: "application/json", // Указываем тип контента
            data: JSON.stringify({ productId, rating }), // Строка JSON с продуктом и рейтингом
            success(response) {
                console.log('Спасибо за ваш голос!'); // Успешное голосование
                $star.parent().find('.star').removeClass('checked'); // Убираем выделение со всех звезд
                $star.prevAll().addBack().addClass('checked'); // Выделяем звезды по выбранному рейтингу
            },
            error(err) {
                console.log('Вы уже голосовали за этот товар или произошла ошибка!'); // Обработка ошибок
            }
        });
    });

    // Обработчик событий для добавления товара в корзину
    $('.add-to-cart').on('click', function () {
        const productId = $(this).data('id'); // Получаем идентификатор продукта
        const productName = $(this).data('name'); // Получаем имя продукта
        const productPrice = parseFloat($(this).data('price')); // Получаем цену продукта и конвертируем в число

        const product = {
            id: productId,
            name: productName,
            price: productPrice
        };

        // Проверяем, есть ли продукт уже в корзине
        const existingProduct = cart.find(item => item.id === productId);

        if (!existingProduct) { // Если продукт не найден в корзине
            cart.push(product); // Добавляем продукт в корзину
            localStorage.setItem('cart', JSON.stringify(cart)); // Сохраняем обновленную корзину в localStorage
            console.log('Товар добавлен в корзину!'); // Успешное добавление товара
            updateCartCount(); // Обновляем количество товаров в корзине при добавлении товара
        } else {
            console.log('Этот товар уже в корзине.'); // Если товар уже в корзине
        }
    });
}

// Функция для отрисовки звездочек на основе рейтинга
function renderStars(rating) {
    let starsHtml = ''; // Инициализация строки для звезд
    for (let i = 1; i <= 5; i++) { // Перебор от 1 до 5 (количество звезд)
        starsHtml += `<span class="star ${i <= rating ? 'checked' : ''}" data-value="${i}">&#9733;</span>`; // Добавляем звездочку с классом 'checked' для уже оцененных
    }
    return starsHtml; // Возвращаем строку с HTML-кодом звезд
}

// Функция для подсчета общей стоимости
function calculateTotal(cart) {
    return cart.reduce((total, item) => total + item.price, 0);
}

// Функция для обновления количества товаров в корзине
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    $('#cart-count').text(cart.length);
}

// Функция для проверки телефонного номера
function validatePhone(phone) {
    // Регулярное выражение для проверки формата телефона
    const phonePattern = /^\+?[0-9]{7,15}$/; // Примерный формат телефонов
    return phonePattern.test(phone);
}

// Функция для проверки адреса электронной почты
function validateEmail(email) {
    // Регулярное выражение для проверки формата электронной почты
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Стандартное выражение для почты
    return emailPattern.test(email);
}

});