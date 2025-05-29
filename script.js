document.addEventListener('DOMContentLoaded', async () => {
    // --- Elementos del DOM (igual que antes) ---
    // ... (mantener los elementos del DOM)
    const userInterface = document.getElementById('user-interface');
    const viewCartBtn = document.getElementById('viewCartBtn');
    const cartModal = document.getElementById('cart-modal');
    const closeCartBtn = document.querySelector('.cart-close');
    const cartItemsList = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const productListDiv = document.getElementById('product-list');
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.querySelector('.image-close');
    
    const checkoutDetailsModal = document.getElementById('checkout-details-modal');
    const closeCheckoutDetailsBtn = document.querySelector('.checkout-details-close');
    const checkoutForm = document.getElementById('checkout-form');
    const shippingMethodSelect = document.getElementById('shippingMethod');
    const shippingCostInfoP = document.getElementById('shippingCostInfo');

    const categoryFiltersDiv = document.getElementById('category-filters');
    const searchBar = document.getElementById('searchBar');
    
    if (document.getElementById('currentYear')) {
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    // --- Configuración ---
    const STORYBLOK_ACCESS_TOKEN = 'B6EQn2DCY3QRavyzoF9I7gtt'; // ¡REEMPLAZA ESTO!
    const WHATSAPP_ORDER_NUMBER = '50237943687'; // Número para enviar pedidos por WhatsApp

    const sb = window.storyblok;
    let storyblokApi;

    if (sb && sb.storyblokInit && sb.apiPlugin) {
        const { storyblokApi: api } = sb.storyblokInit({
            accessToken: STORYBLOK_ACCESS_TOKEN,
            use: [sb.apiPlugin],
            apiOptions: { cache: { type: 'memory', clear: 'auto' } }
        });
        storyblokApi = api;
    } else {
        console.error("Storyblok SDK no se cargó.");
        if(productListDiv) productListDiv.innerHTML = '<p style="color:red;">Error: Storyblok SDK no pudo cargarse.</p>';
        return;
    }

    // --- Datos (igual que antes) ---
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let currentFilterCategory = 'all';
    let searchTerm = '';

    // --- Funciones Auxiliares, de Storyblok y de Renderizado (sin cambios respecto a la última versión) ---
    // ... (copia aquí las funciones: showInterface, saveCart, fetchCategoriesFromStoryblok, 
    // fetchProductsFromStoryblok, renderProducts, renderCategoryFilters, addToCart, updateCartDisplay)

    function showInterface(interfaceToShow) {
        if (document.getElementById('user-interface')) document.getElementById('user-interface').classList.remove('active');
        interfaceToShow.classList.add('active');
    }

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
    }

    async function fetchCategoriesFromStoryblok() {
        if (!storyblokApi) return [];
        try {
            const { data } = await storyblokApi.get('cdn/stories', {
                content_type: 'category',
                version: 'published'
            });
            return data.stories.map(story => ({ id: story.uuid, name: story.content.name }));
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }

    async function fetchProductsFromStoryblok() {
        if (!storyblokApi) return [];
        try {
            const { data } = await storyblokApi.get('cdn/stories', {
                content_type: 'product',
                resolve_relations: 'product.category_ref',
                version: 'published'
            });
            return data.stories.map(story => {
                const categoryNames = (story.content.category_ref && Array.isArray(story.content.category_ref))
                    ? story.content.category_ref
                        .map(ref => (ref && ref.content && ref.content.name) ? ref.content.name : null)
                        .filter(name => name !== null)
                    : [];
                return {
                    id: story.uuid,
                    name: story.content.name,
                    description: story.content.description || '',
                    price: parseFloat(story.content.price) || 0,
                    stock: parseInt(story.content.stock) || 0,
                    category_names: categoryNames,
                    images: story.content.images ? story.content.images.map(img => img.filename) : [],
                    originalStock: parseInt(story.content.stock) || 0
                };
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }
    
    function renderProducts() {
        if (!productListDiv) return;
        productListDiv.innerHTML = '';
        let productsToDisplay = [...products]; 

        if (currentFilterCategory !== 'all') {
            productsToDisplay = productsToDisplay.filter(p => p.category_names && p.category_names.includes(currentFilterCategory));
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            productsToDisplay = productsToDisplay.filter(p =>
                p.name.toLowerCase().includes(lowerSearchTerm) ||
                (p.description && p.description.toLowerCase().includes(lowerSearchTerm))
            );
        }

        if (productsToDisplay.length === 0) {
            let message = "No se encontraron productos que coincidan con tu búsqueda o filtros.";
            if (products.length === 0 && (!STORYBLOK_ACCESS_TOKEN || STORYBLOK_ACCESS_TOKEN === 'TU_ACCESS_TOKEN_DE_PREVISUALIZACION')) {
                message = `<p style="color:var(--rosa-pastel);">Por favor, configura tu Access Token de Storyblok en <code>script.js</code>.</p>`;
            } else if (products.length === 0) {
                message = "No hay productos cargados. Verifica tu conexión y la configuración de Storyblok.";
            }
            productListDiv.innerHTML = `<p style="text-align:center;">${message}</p>`;
            return;
        }

        productsToDisplay.forEach(product => {
            const productItem = document.createElement('div');
            productItem.classList.add('product-item');
            const mainImageUrl = product.images && product.images.length > 0 
                                ? product.images[0] 
                                : `https://via.placeholder.com/1024x1024?text=${encodeURIComponent(product.name)}`;
            const currentProductInCart = cart.find(item => item.id === product.id);
            const currentQuantityInCart = currentProductInCart ? currentProductInCart.quantity : 0;
            const availableStock = product.originalStock - currentQuantityInCart;
            const isOutOfStock = availableStock <= 0;
            const buttonText = isOutOfStock ? 'AGOTADO' : 'Agregar al Carrito';
            const buttonDisabled = isOutOfStock ? 'disabled' : '';

            productItem.innerHTML = `
                <img src="${mainImageUrl}" alt="${product.name}" class="main-image" data-full-image="${mainImageUrl}">
                <div class="thumbnail-gallery">
                    ${product.images && product.images.map((imgUrl, index) => `
                        <img src="${imgUrl}" alt="Thumbnail ${index + 1}" data-main-src="${imgUrl}" data-full-image="${imgUrl}">
                    `).join('')}
                </div>
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p class="price">Q ${product.price.toFixed(2)}</p>
                <button data-id="${product.id}" ${buttonDisabled}>${buttonText}</button>
            `;
            productListDiv.appendChild(productItem);

            const mainImageElement = productItem.querySelector('.main-image');
            if (mainImageElement){
                mainImageElement.addEventListener('click', (event) => {
                    const fullImageUrl = event.target.dataset.fullImage;
                    if (fullImageUrl && modalImage && imageModal) {
                        modalImage.src = fullImageUrl;
                        imageModal.style.display = 'flex';
                    }
                });
            }
            productItem.querySelectorAll('.thumbnail-gallery img').forEach(thumbnail => {
                thumbnail.addEventListener('click', (event) => {
                     if (mainImageElement) {
                        mainImageElement.src = event.target.dataset.mainSrc;
                        mainImageElement.dataset.fullImage = event.target.dataset.fullImage;
                    }
                });
            });
        });

        document.querySelectorAll('#product-list .product-item button').forEach(button => {
            button.addEventListener('click', (event) => {
                addToCart(event.target.dataset.id);
            });
        });
    }

    function renderCategoryFilters() {
        if (!categoryFiltersDiv) return;
        categoryFiltersDiv.innerHTML = '';
        const allButton = document.createElement('button');
        allButton.classList.add('filter-btn');
        if (currentFilterCategory === 'all') allButton.classList.add('active');
        allButton.dataset.category = 'all';
        allButton.textContent = 'Todas las Categorías';
        categoryFiltersDiv.appendChild(allButton);

        categories.forEach(category => {
            const button = document.createElement('button');
            button.classList.add('filter-btn');
            if (currentFilterCategory === category.name) button.classList.add('active');
            button.dataset.category = category.name;
            button.textContent = category.name;
            categoryFiltersDiv.appendChild(button);
        });

        document.querySelectorAll('#category-filters .filter-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                document.querySelectorAll('#category-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                currentFilterCategory = event.target.dataset.category;
                renderProducts();
            });
        });
    }

    function addToCart(productId) {
        const productToAdd = products.find(p => p.id === productId);
        if (!productToAdd) {
            alert("Producto no encontrado.");
            return;
        }
        const existingCartItem = cart.find(item => item.id === productId);
        const currentQuantityInCart = existingCartItem ? existingCartItem.quantity : 0;
        
        if (currentQuantityInCart < productToAdd.originalStock) {
            if (existingCartItem) {
                existingCartItem.quantity++;
            } else {
                cart.push({ 
                    id: productToAdd.id, 
                    name: productToAdd.name, 
                    price: productToAdd.price, 
                    quantity: 1,
                });
            }
            saveCart();
            alert(`${productToAdd.name} añadido al carrito.`);
            renderProducts(); 
        } else {
            alert(`No hay más stock disponible de ${productToAdd.name}.`);
        }
    }

    function updateCartDisplay() {
        if (!cartItemsList || !cartTotalSpan || !checkoutBtn) return;

        cartItemsList.innerHTML = '';
        let total = 0;
        if (cart.length === 0) {
            cartItemsList.innerHTML = '<li>El carrito está vacío.</li>';
        } else {
            cart.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${item.name} (${item.quantity}x)</span>
                    <span>Q ${(item.price * item.quantity).toFixed(2)}</span>
                `;
                cartItemsList.appendChild(li);
                total += item.price * item.quantity;
            });
        }
        cartTotalSpan.textContent = total.toFixed(2);
        checkoutBtn.disabled = cart.length === 0;
    }

    // --- Lógica de Checkout y Envío por WhatsApp (MODIFICADO) ---
    function generateOrderMessageForWhatsApp(details) {
        let message = `¡Nuevo Pedido A&D Suministros!\n\n`;
        message += `👤 *CLIENTE:*\n`;
        message += `  Nombre: ${details.customerName}\n`;
        message += `  Teléfono: ${details.customerPhone}\n`;
        message += `  Dirección: ${details.customerAddress}\n\n`;

        message += `🛒 *DETALLE DEL PEDIDO:*\n`;
        let subtotalPedido = 0;
        details.cart.forEach(item => {
            message += `  - ${item.name} (Cant: ${item.quantity}) - Q${(item.price * item.quantity).toFixed(2)}\n`;
            subtotalPedido += item.price * item.quantity;
        });
        message += `\n  *Subtotal:* Q${subtotalPedido.toFixed(2)}\n`;

        let costoEnvio = 0;
        let costoEnvioTexto = "No aplica";
        if (details.shippingMethodValue === 'capital_35') {
            costoEnvio = 35;
            costoEnvioTexto = `Q${costoEnvio.toFixed(2)}`;
        } else if (details.shippingMethodValue === 'departamentos_cotizar') {
            costoEnvioTexto = "A cotizar";
        }
        message += `  *Envío (${details.shippingMethodText}):* ${costoEnvioTexto}\n`;
        
        const granTotal = subtotalPedido + costoEnvio;
        message += `\n💰 *TOTAL PEDIDO:* Q${granTotal.toFixed(2)} ${details.shippingMethodValue === 'departamentos_cotizar' ? '(Envío pendiente cotización)' : ''}\n\n`;
        
        message += `🚚 *MÉTODO DE ENVÍO:*\n  ${details.shippingMethodText}\n\n`;
        message += `💳 *MÉTODO DE PAGO:*\n  ${details.paymentMethod}\n\n`;
        message += `Por favor, confirmar y coordinar.`;

        return encodeURIComponent(message);
    }

    function sendOrderByWhatsApp(details) {
        const whatsappNumber = WHATSAPP_ORDER_NUMBER;
        const message = generateOrderMessageForWhatsApp(details);
        const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;
        
        window.open(whatsappLink, '_blank');

        // Limpiar y resetear
        cart = [];
        saveCart(); 
        renderProducts();
        
        if(checkoutDetailsModal) checkoutDetailsModal.style.display = 'none';
        if(checkoutForm) checkoutForm.reset();
        if(shippingCostInfoP) shippingCostInfoP.textContent = '';

        alert('Serás redirigido a WhatsApp para enviar tu pedido. ¡Gracias por tu compra!');
    }


    // --- Event Listeners (Ajustados para el nuevo flujo de WhatsApp) ---
    if (viewCartBtn) {
        viewCartBtn.addEventListener('click', () => {
            if (cartModal) cartModal.style.display = 'flex';
            updateCartDisplay();
        });
    }
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => {
        if (cartModal) cartModal.style.display = 'none';
    });

    if (checkoutBtn) { 
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Tu carrito está vacío. Agrega productos antes de finalizar la compra.');
                return;
            }
            if (cartModal) cartModal.style.display = 'none';
            if (checkoutDetailsModal) checkoutDetailsModal.style.display = 'flex';
        });
    }
    
    if (closeCheckoutDetailsBtn) {
        closeCheckoutDetailsBtn.addEventListener('click', () => {
            if (checkoutDetailsModal) checkoutDetailsModal.style.display = 'none';
        });
    }

    if (shippingMethodSelect) {
        shippingMethodSelect.addEventListener('change', function() {
            if (!shippingCostInfoP) return;
            if (this.value === 'capital_35') {
                shippingCostInfoP.textContent = 'Costo de envío aplicable: Q35.00';
            } else if (this.value === 'departamentos_cotizar') {
                shippingCostInfoP.textContent = 'El costo de envío se cotizará y confirmará por separado.';
            } else {
                shippingCostInfoP.textContent = '';
            }
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (cart.length === 0) {
                alert('Error: El carrito está vacío.');
                return;
            }
            const customerName = document.getElementById('customerName').value;
            const customerPhone = document.getElementById('customerPhone').value;
            const customerAddress = document.getElementById('customerAddress').value;
            const shippingSelect = document.getElementById('shippingMethod');
            const shippingMethodValue = shippingSelect.value;
            const shippingMethodText = shippingSelect.options[shippingSelect.selectedIndex].text;
            const paymentMethod = document.getElementById('paymentMethod').value;

            // Llamar a la función de WhatsApp en lugar de la de correo
            sendOrderByWhatsApp({
                customerName,
                customerPhone,
                customerAddress,
                shippingMethodValue,
                shippingMethodText,
                paymentMethod,
                cart: [...cart] 
            });
        });
    }
    
    if (searchBar) {
        searchBar.addEventListener('input', (event) => {
            searchTerm = event.target.value; 
            renderProducts();
        });
    }

    if(closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', () => {
            if(imageModal) imageModal.style.display = 'none';
            if(modalImage) modalImage.src = '';
        });
    }

    window.addEventListener('click', (event) => {
        if (cartModal && event.target === cartModal) cartModal.style.display = 'none';
        if (imageModal && event.target === imageModal) {
            imageModal.style.display = 'none';
            if(modalImage) modalImage.src = '';
        }
        if (checkoutDetailsModal && event.target === checkoutDetailsModal) checkoutDetailsModal.style.display = 'none';
    });

    // --- Inicialización ---
    async function initializeApp() {
        if (!storyblokApi) {
            console.error("Fallo en la inicialización de Storyblok API.");
            return;
        }
        if (!STORYBLOK_ACCESS_TOKEN || STORYBLOK_ACCESS_TOKEN === 'TU_ACCESS_TOKEN_DE_PREVISUALIZACION') {
            console.error("Storyblok Access Token no configurado.");
            if(productListDiv) productListDiv.innerHTML = '<p style="color:red;">Error: Falta el Access Token de Storyblok.</p>';
            return;
        }
        
        categories = await fetchCategoriesFromStoryblok();
        products = await fetchProductsFromStoryblok();
        
        renderCategoryFilters();
        renderProducts();
        updateCartDisplay(); 
        
        if (userInterface) showInterface(userInterface); // Solo si userInterface existe
        if (cartModal) cartModal.style.display = 'none';
        if (imageModal) imageModal.style.display = 'none';
        if (checkoutDetailsModal) checkoutDetailsModal.style.display = 'none';
    }

    initializeApp();
});