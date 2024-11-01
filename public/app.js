// Ждем, когда вся страница будет загружена и готова к взаимодействию
$(document).ready(function () {

    // Обновляем количество товаров в корзине при загрузке страницы
    updateCartCount();

    const PRODUCT_URL = "/api/products"; // URL для получения списка продуктов
    const RATE_URL = "/api/rate"; // URL для отправки рейтинга продукта
    let cart = JSON.parse(localStorage.getItem('cart')) || []; // Загружаем корзину из localStorage или инициализируем пустым массивом

    // Загрузка списка продуктов с сервера с обработкой ошибок
    $.get(PRODUCT_URL)
        .done(function (data) {
            const products = JSON.parse(data); // Парсим полученные данные из JSON
            displayProducts(products); // Отображаем продукты на странице
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            console.error("Ошибка загрузки продуктов: ", textStatus, errorThrown);
            alert("Не удалось загрузить продукты. Пожалуйста, попробуйте позже.");
        });

    // Обработчик нажатия кнопки "Оформить заказ"
    $('#place-order').on('click', function (event) {
        event.preventDefault(); // Предотвращение отправки формы по умолчанию

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
            // Логика отправки заказа
            const orderData = { items: cart, total: calculateTotal(cart) };

            // Отправляем заказ на сервер
            $.ajax({
                type: "POST",
                url: "/api/place-order", // URL вашего сервера для обработки заказа
                contentType: "application/json",
                data: JSON.stringify(orderData),
                success: function (response) {
                    console.log(response);
                    $('#successMessage').text(`Заказ ${response.orderId} успешно отправлен!`);
                    localStorage.removeItem('cart'); // Очищаем корзину 
                    cart = []; // Обнуляем локальную переменную
                    updateCartCount(); // Обновляем счетчик до 0
                    form.reset(); // Очищаем форму
                },
                error: function (jqXHR) {
                    console.error("Ошибка оформления заказа: ", jqXHR);
                    alert("Ошибка оформления заказа: " + jqXHR.responseText);
                }
            });
        }
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
            cartItems.append(`<li class="list-group-item">${item.name} - ${item.price.toFixed(2)}</li>`);
            totalPrice += item.price;
        });

        $('#total-price').text(`Всего: ${totalPrice.toFixed(2)}`);

        // Показываем модальное окно
        const cartModal = new bootstrap.Modal(document.getElementById('cart'), { keyboard: false });
        cartModal.show();
    }

    // Функция для отображения продуктов на странице
    function displayProducts(products) {
        $('#product-list').empty(); // Очищаем список продуктов перед добавлением новых
        products.forEach(product => {
            const productHtml = `
                <div class="col-md-4">
                    <div class="card mb-4 shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <h3 class="card-title">${product.price.toFixed(2)}</h3>
                            <div class="card-text">
                                ${renderStars(product.rating)}
                                <span>(${product.votes})</span>
                            </div>
                            <button data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" class="btn btn-primary add-to-cart">Добавить в корзину</button>
                        </div>
                    </div>
                </div>
            `;
            $('#product-list').append(productHtml);
        });

        // Обработчик событий для добавления товара в корзину
        $('.add-to-cart').on('click', function () {
            const productId = $(this).data('id');
            const productName = $(this).data('name');
            const productPrice = parseFloat($(this).data('price'));

            const product = {
                id: productId,
                name: productName,
                price: productPrice
            };

            // Проверяем, есть ли продукт уже в корзине
            const existingProduct = cart.find(item => item.id === productId);
            if (!existingProduct) {
                cart.push(product);
                localStorage.setItem('cart', JSON.stringify(cart));
                console.log('Товар добавлен в корзину!');
                updateCartCount();
            } else {
                console.log('Этот товар уже в корзине.');
            }
        });

        // Обработчик событий для звездочного рейтинга
        $('.star').on('click', function (e) {
            const $star = $(e.target);
            const productId = $star.closest('.card').find('.add-to-cart').data('id');
            const rating = $star.data('value');

            // Отправка рейтинга на сервер
            $.ajax({
                url: RATE_URL,
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ productId, rating }),
                success: function (response) {
                    console.log('Спасибо за ваш голос!');
                    $star.parent().find('.star').removeClass('checked');
                    $star.prevAll().addBack().addClass('checked');
                },
                error: function (err) {
                    console.log('Ошибка при голосовании: ' + err.responseText);
                }
            });
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