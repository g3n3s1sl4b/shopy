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
        placeOrder();
    });

    // Валидация и отправка заказа
    function placeOrder() {
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
    }

    // Обработчик нажатия на иконку корзины
    $('#cart-icon').on('click', function () {
        displayCart();
    });

   // Функция для отображения корзины
   function displayCart() {
    const cartItems = $('#cart-items');
    cartItems.empty(); 
    let totalPrice = 0;

    // Отображение элементов корзины
    cart.forEach(item => {
        totalPrice += item.price * item.quantity; // Учитываем количество при расчете стоимости
        cartItems.append(`
            <li class="list-group-item">
                ${item.name} - ${item.price.toFixed(2)} x ${item.quantity} 
                <button data-id="${item.id}" class="btn btn-outline-secondary change-quantity increment">+</button>
                <button data-id="${item.id}" class="btn btn-outline-secondary change-quantity decrement">-</button>
                <button data-id="${item.id}" class="btn btn-danger remove-item">Удалить</button>
            </li>
        `);
    });

    $('#total-price').text(`Всего: ${totalPrice.toFixed(2)}`);
    const cartModal = new bootstrap.Modal(document.getElementById('cart'), { keyboard: false });
    cartModal.show();
}

    function displayProducts(products) {
        $('#product-list').empty(); 
        products.forEach(product => {
            const discountBadge = product.discount ? `<span class="badge bg-success position-absolute top-0 end-0 m-2">Скидка: ${product.discount}%</span>` : '';
            const saleBadge = product.onSale ? `<span class="badge bg-danger position-absolute top-0 start-0 m-2">Распродажа</span>` : '';
    
            const productHtml = `
                <div class="col-md-4 position-relative">
                    <div class="card mb-4 shadow-sm text-center">
                        <img src="${product.image}" class="card-img-top" alt="${product.name}" style="object-fit: cover; height: 200px;">
                        ${discountBadge} ${saleBadge}
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <h6 class="brand-name">Бренд: ${product.brand}</h6>
                            <p>Артикул: ${product.sku}</p>
                            <p>Серийный номер: ${product.serial}</p>
                            <h3 class="card-price">${product.price.toFixed(2)}</h3>
                            <div class="card-text">
                                ${renderStars(product.rating)}
                                <span> (${product.votes})</span>
                            </div>
                            <div class="input-group mb-3">
                                <button class="btn btn-outline-secondary change-quantity decrement">−</button>
                                <input type="number" class="form-control product-quantity" value="1" min="1" style="width: 60px;">
                                <button class="btn btn-outline-secondary change-quantity increment">+</button>
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
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="star ${i <= rating ? 'checked' : ''}" data-value="${i}" style="font-size: 24px; color: gold;">&#9733;</span>`;
        }
        return starsHtml;
    }

    // Функция для изменения количества товаров в корзине
    $('#cart').on('click', '.change-quantity', function () {
        const id = $(this).data('id');
        const item = cart.find(item => item.id === id);
        if ($(this).hasClass('increment')) {
            item.quantity++;
        } else if ($(this).hasClass('decrement') && item.quantity > 1) {
            item.quantity--;
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        displayCart(); // Обновляем отображение корзины
    });

    // Удаление товара из корзины
    $('#cart').on('click', '.remove-item', function () {
        const id = $(this).data('id');
        cart = cart.filter(item => item.id !== id);
        localStorage.setItem('cart', JSON.stringify(cart));
        displayCart(); // Обновляем отображение корзины
    });

    // Функция для расчета общей стоимости
    function calculateTotal(cart) {
        return cart.reduce((total, item) => total + item.price * item.quantity, 0);
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