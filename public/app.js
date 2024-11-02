$(document).ready(function () {
  // Обновляем количество товаров в корзине при загрузке страницы
  updateCartCount();

  const PRODUCT_URL = "/api/products";
  const RATE_URL = "/api/rate";
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  // Централизованный обработчик ошибок AJAX
  function handleAjaxError(jqXHR, textStatus, errorThrown, customMessage) {
    console.error(`${customMessage}:`, textStatus, errorThrown);
    const responseMessage = jqXHR.responseJSON?.message || jqXHR.statusText || "Неизвестная ошибка";
    alert(`${customMessage}: ${responseMessage}`);
  }

  // Отображение фильтрации продуктов по категории
  $(".btn-filter").click(function () {
    const category = $(this).data("category");
    const url = category ? `${PRODUCT_URL}?category=${category}` : PRODUCT_URL;

    $.get(url)
      .done(displayProducts)
      .fail((jqXHR, textStatus, errorThrown) => {
        handleAjaxError(jqXHR, textStatus, errorThrown, "Ошибка загрузки продуктов");
      });
  });

  // Загрузка списка продуктов с сервера
  $.get(PRODUCT_URL)
    .done(function (data) {
      const products = JSON.parse(data);
      displayProducts(products);
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      handleAjaxError(jqXHR, textStatus, errorThrown, "Ошибка загрузки продуктов");
    });

  function placeOrder() {
    const form = document.getElementById("orderForm");
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;

    errorMessage.textContent = "";
    successMessage.textContent = "";

    let valid = true;

    if (!validateEmail(email)) {
      errorMessage.textContent += "Неправильный адрес электронной почты.\n";
      valid = false;
    }

    if (!validatePhone(phone)) {
      errorMessage.textContent += "Неправильный номер телефона. Используйте формат: +1234567890.\n";
      valid = false;
    }

    if (valid) {
      const orderData = { items: cart, total: calculateTotal(cart) };

      $.ajax({
        type: "POST",
        url: "/api/place-order",
        contentType: "application/json",
        data: JSON.stringify(orderData),
        success: function (response) {
          $("#successMessage").text(`Заказ ${response.orderId} успешно отправлен!`);
          cart = [];
          localStorage.setItem("cart", JSON.stringify(cart));
          updateCartCount();
          form.reset();
        },
        error: function (jqXHR, textStatus, errorThrown) {
          handleAjaxError(jqXHR, textStatus, errorThrown, "Ошибка оформления заказа");
        },
      });
    }
  }

  function displayCart() {
    const cartItems = $("#cart-items");
    cartItems.empty();
    let totalPrice = 0;

    if (cart.length === 0) {
      cartItems.html(`<li class="list-group-item text-center">Корзина пуста!</li>`);
      $("#place-order").hide();
      $("#orderForm").hide();
      $("#total-price").text("");
    } else {
      cart.forEach((item) => {
        totalPrice += item.price * item.quantity;
        cartItems.append(`
          <li class="list-group-item d-flex justify-content-between align-items-center">
            ${item.name} - ${item.price.toFixed(2)} x ${item.quantity} = ${(item.quantity * item.price).toFixed(2)}
            <div>
              <button data-id="${item.id}" class="btn btn-outline-secondary change-quantity increment">+</button>
              <button data-id="${item.id}" class="btn btn-outline-secondary change-quantity decrement">-</button>
              <button data-id="${item.id}" class="btn btn-danger remove-item">Удалить</button>
            </div>
          </li>
        `);
      });

      $("#total-price").text(`Всего: ${totalPrice.toFixed(2)}`);
    }

    const cartModal = new bootstrap.Modal(document.getElementById("cart"), {
      keyboard: false,
    });
    cartModal.show();
  }

  function displayProducts(products) {
    $("#product-list").empty();

    products.forEach((product) => {
      const discountBadge = product.discount ? `<span class="badge bg-success position-absolute top-0 end-0 m-2">Скидка: ${product.discount}%</span>` : "";
      const saleBadge = product.onSale ? `<span class="badge bg-danger position-absolute top-0 start-0 m-2">Распродажа</span>` : "";

      const productHtml = `
        <div class="col-12 col-md-6 col-lg-4 position-relative">
          <div class="card mb-4 shadow-sm text-center" style="border-radius: 5px;">
            <img src="${product.image}" class="card-img-top product-image" alt="${product.name}" style="object-fit: cover; border-top-left-radius: 5px; border-top-right-radius: 5px;" data-id="${product.id}">
            ${discountBadge} ${saleBadge}
            <div class="card-body">
              <h5 class="card-title">${product.brand} : ${product.name}</h5>
              <h3 class="card-price">${product.price.toFixed(2)} $</h3>
              <button data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" class="btn btn-primary add-to-cart">Buy</button>
              <button data-id="${product.id}" class="btn btn-secondary show-attributes">Spec</button>
            </div>
            <div class="card-footer text-body-secondary">
              <div class="card-text">
                ${renderStars(product.rating)}
                <span class="votes-count">(${product.votes})</span>
              </div>
            </div>
          </div>
        </div>
      `;
      $("#product-list").append(productHtml);
    });

    $(".show-attributes").on("click", function () {
      const productId = $(this).data("id");
      showProductAttributes(productId);
    });

    $(".add-to-cart").on("click", function () {
      const $button = $(this);
      const productId = $button.data("id");
      const productName = $button.data("name");
      const productPrice = parseFloat($button.data("price"));
      const quantity = 1;

      const product = { id: productId, name: productName, price: productPrice, quantity: quantity };

      const existingProduct = cart.find((item) => item.id === productId);
      if (!existingProduct) {
        cart.push(product);
        console.log("Товар добавлен в корзину!");
      } else {
        existingProduct.quantity += quantity;
        console.log("Количество товара обновлено в корзине");
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartCount();
      $button.text("Товар добавлен").css("background-color", "black").prop("disabled", true);
    });

    $(".star").on("click", function (e) {
      const $star = $(e.target);
      const productId = $star.closest(".card").find(".add-to-cart").data("id");
      const rating = $star.data("value");
      console.log(productId, rating);

      $.ajax({
        url: RATE_URL,
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({ productId, rating }),
        success: function (response) {
          console.log("Спасибо за ваш голос!");
          alert("Спасибо за ваш голос!");
          $star.parent().find(".star").removeClass("checked");
          $star.prevAll().addBack().addClass("checked");
        },
        error: function (jqXHR, textStatus, errorThrown) {
          handleAjaxError(jqXHR, textStatus, errorThrown, "Ошибка при голосовании");
        },
      });
    });
  }

  function renderStars(rating) {
    let starsHtml = ""; 
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="star ${i <= rating ? "checked" : ""}" data-value="${i}">&#9733;</span>`; 
    }
    return starsHtml;
  }

  function showProductAttributes(productId) {
    $.get(`${PRODUCT_URL}/${productId}`)
      .done(function (data) {
        const product = data;
        let attributesHtml = '<table class="table table-striped">';
        attributesHtml += `<thead>
          <tr>
            <th>Характеристика</th>
            <th>Значение</th>
          </tr>
        </thead><tbody>`;
        for (const [key, value] of Object.entries(product.attributes)) {
          attributesHtml += `<tr>
            <td>${key}</td>
            <td>${value}</td>
          </tr>`;
        }
        attributesHtml += "</tbody></table>";

        const attributesModal = new bootstrap.Modal($("#attributes-modal"));
        $("#attributes-modal .modal-body").html(attributesHtml);
        attributesModal.show();
      })
      .fail((jqXHR, textStatus, errorThrown) => {
        handleAjaxError(jqXHR, textStatus, errorThrown, "Ошибка загрузки характеристик продукта");
      });
  }

  function calculateTotal(cart) {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    $("#cart-count").text(cart.length);
  }

  function validatePhone(phone) {
    const phonePattern = /^\+?[0-9]{7,15}$/;
    return phonePattern.test(phone);
  }

  function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  $("#place-order").on("click", function (event) {
    event.preventDefault();
    placeOrder();
  });

  $("#cart-icon").on("click", function () {
    displayCart();
  });

  $("#product-list").on("click", ".card-img-top", function () {
    const imgSrc = $(this).attr("src");
    $("#modal-image").attr("src", imgSrc);
    const imageModal = new bootstrap.Modal(document.getElementById("image-modal"));
    imageModal.show();
  });

  $("#cart").on("click", ".change-quantity", function () {
    const id = $(this).data("id");
    const item = cart.find((item) => item.id === id);
    
    let changed = false;

    if ($(this).hasClass("increment")) {
      item.quantity++;
      changed = true;
    } else if ($(this).hasClass("decrement") && item.quantity > 1) {
      item.quantity--;
      changed = true;
    }

    if (changed) {
      localStorage.setItem("cart", JSON.stringify(cart));
      displayCart();
    }
  });

  $("#cart").on("click", ".remove-item", function () {
    const id = $(this).data("id");
    cart = cart.filter((item) => item.id !== id);
    localStorage.setItem("cart", JSON.stringify(cart));
    displayCart();
  });
});