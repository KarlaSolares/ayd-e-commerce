document.addEventListener('DOMContentLoaded', async () => {
    // --- Elementos del DOM (igual que antes) ---
    // ... (copia esta sección de la respuesta anterior)
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
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentModalBtn = document.querySelector('.payment-close');
    const payCashBtn = document.getElementById('payCashBtn');
    const payTransferBtn = document.getElementById('payTransferBtn');
    const categoryFiltersDiv = document.getElementById('category-filters');

    // --- Configuración de Storyblok (igual que antes) ---
    const STORYBLOK_ACCESS_TOKEN = 'B6EQn2DCY3QRavyzoF9I7gtt';
    const WHATSAPP_PHONE = '50237943687';
    const sb = window.storyblok;
    let storyblokApi;

    if (sb && sb.storyblokInit && sb.apiPlugin) {
        const { storyblokApi: api } = sb.storyblokInit({
            accessToken: STORYBLOK_ACCESS_TOKEN,
            use: [sb.apiPlugin],
            apiOptions: {
                cache: { type: 'memory', clear: 'auto' },
                // region: 'eu', 
            }
        });
        storyblokApi = api;
    } else {
        console.error("Storyblok SDK no se cargó correctamente.");
        productListDiv.innerHTML = '<p style="text-align: center; color: var(--rosa-pastel);">Error: Storyblok SDK no pudo cargarse.</p>';
        return;
    }

    // --- Datos (igual que antes) ---
    let products = [];
    let categories = [];
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let currentFilterCategory = 'all';

    // --- Funciones Auxiliares (showInterface, saveCart - igual que antes) ---
    function showInterface(interfaceToShow) {
        // ... (código igual que antes)
        if (document.getElementById('user-interface')) document.getElementById('user-interface').classList.remove('active');
        interfaceToShow.classList.add('active');
    }

    function saveCart() {
        // ... (código igual que antes)
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
    }

    // --- Funciones para obtener datos de Storyblok ---
    
    // fetchCategoriesFromStoryblok sigue igual
    async function fetchCategoriesFromStoryblok() {
        if (!storyblokApi) return [];
        try {
            const { data } = await storyblokApi.get('cdn/stories', {
                content_type: 'category',
                version: 'published'
            });
            console.log("Categorías desde Storyblok:", data.stories);
            return data.stories.map(story => ({
                id: story.uuid,
                name: story.content.name
            }));
        } catch (error) {
            console.error('Error fetching categories from Storyblok:', error);
            categoryFiltersDiv.innerHTML = '<p style="text-align: center; color: var(--rosa-pastel);">Error al cargar categorías.</p>';
            return [];
        }
    }

    // MODIFICACIÓN AQUÍ: fetchProductsFromStoryblok para manejar múltiples categorías
    async function fetchProductsFromStoryblok() {
        if (!storyblokApi) return [];
        try {
            const { data } = await storyblokApi.get('cdn/stories', {
                content_type: 'product',
                // resolve_relations debería funcionar para campos Multi-Options que referencian stories.
                // Se espera que story.content.category_ref sea un array de objetos de categoría resueltos.
                resolve_relations: 'product.category_ref', 
                version: 'published'
            });
            console.log("Productos desde Storyblok (con posible array de categorías):", data.stories);
            return data.stories.map(story => {
                // Procesar el array de referencias de categoría
                const categoryNames = (story.content.category_ref && Array.isArray(story.content.category_ref))
                    ? story.content.category_ref
                        // Mapear cada referencia resuelta a su nombre de categoría
                        .map(ref => (ref && ref.content && ref.content.name) ? ref.content.name : null)
                        // Filtrar cualquier nulo (si una referencia no se resolvió o no tenía nombre)
                        .filter(name => name !== null)
                    : []; // Si no hay category_ref o no es un array, lista vacía

                return {
                    id: story.uuid,
                    name: story.content.name,
                    description: story.content.description || '',
                    price: parseFloat(story.content.price) || 0,
                    stock: parseInt(story.content.stock) || 0,
                    // NUEVO: Almacena un array de nombres de categoría
                    category_names: categoryNames, 
                    images: story.content.images ? story.content.images.map(img => img.filename) : [],
                    originalStock: parseInt(story.content.stock) || 0
                };
            });
        } catch (error) {
            console.error('Error fetching products from Storyblok:', error);
            productListDiv.innerHTML = '<p style="text-align: center; color: var(--rosa-pastel);">Error al cargar productos. Revisa la consola y tu configuración.</p>';
            return [];
        }
    }

    // --- Funciones de Renderizado ---

    // MODIFICACIÓN AQUÍ: renderProducts para filtrar por array de categorías
    function renderProducts() {
        productListDiv.innerHTML = '';

        // Filtrar productos: si 'all', mostrar todos.
        // Si hay una categoría seleccionada, mostrar productos cuyo array 'category_names' INCLUYA esa categoría.
        const filteredProducts = currentFilterCategory === 'all'
            ? products
            : products.filter(p => p.category_names && p.category_names.includes(currentFilterCategory));

        // ... (el resto de la lógica de renderProducts para mensajes de error y creación de items es igual que antes)
        if (filteredProducts.length === 0 && products.length > 0) {
            productListDiv.innerHTML = '<p style="text-align: center;">No hay productos disponibles en esta categoría.</p>';
            return;
        }
        if (products.length === 0 && (!STORYBLOK_ACCESS_TOKEN || STORYBLOK_ACCESS_TOKEN === 'TU_ACCESS_TOKEN_DE_PREVISUALIZACION') ) {
             productListDiv.innerHTML = `<p style="text-align: center; color: var(--rosa-pastel);">Por favor, configura tu Access Token de Storyblok en <code>script.js</code>.</p>`;
            return;
        }
        if (filteredProducts.length === 0 && products.length === 0) {
            if (productListDiv.innerHTML === '') { 
                 productListDiv.innerHTML = '<p style="text-align: center;">No hay productos para mostrar. Verifica que tengas productos y categorías publicados en Storyblok.</p>';
            }
            return;
        }

        filteredProducts.forEach(product => {
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

            // Mostrar categorías del producto (opcional, como ejemplo)
            // const categoriesText = product.category_names && product.category_names.length > 0 
            //                       ? `Categorías: ${product.category_names.join(', ')}` 
            //                       : 'Sin categoría asignada';
            const formatedPrice = product.price/100;

            productItem.innerHTML = `
                <img src="${mainImageUrl}" alt="${product.name}" class="main-image" data-full-image="${mainImageUrl}">
                <div class="thumbnail-gallery">
                    ${product.images && product.images.map((imgUrl, index) => `
                        <img src="${imgUrl}" alt="Thumbnail ${index + 1}" data-main-src="${imgUrl}" data-full-image="${imgUrl}">
                    `).join('')}
                </div>
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p class="price">Q ${formatedPrice.toFixed(2)}</p>
                <button data-id="${product.id}" ${buttonDisabled}>${buttonText}</button>
            `;
            productListDiv.appendChild(productItem);

            const mainImageElement = productItem.querySelector('.main-image');
            productItem.querySelectorAll('.thumbnail-gallery img').forEach(thumbnail => {
                thumbnail.addEventListener('click', (event) => {
                    mainImageElement.src = event.target.dataset.mainSrc;
                    mainImageElement.dataset.fullImage = event.target.dataset.fullImage;
                });
            });
            mainImageElement.addEventListener('click', (event) => {
                const fullImageUrl = event.target.dataset.fullImage;
                if (fullImageUrl) {
                    modalImage.src = fullImageUrl;
                    imageModal.style.display = 'flex';
                }
            });
        });

        document.querySelectorAll('#product-list .product-item button').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                addToCart(productId);
            });
        });
    }
    
    // renderCategoryFilters sigue igual
    function renderCategoryFilters() {
        // ... (código igual que antes)
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

    // --- Funcionalidades del Carrito (addToCart, updateCartDisplay - igual que antes) ---
    function addToCart(productId) {
        // ... (código igual que antes)
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
        // ... (código igual que antes)
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
    }

    // --- Flujo de compra (generateWhatsAppMessage, finalizeOrder - igual que antes) ---
    function generateWhatsAppMessage(method) {
        // ... (código igual que antes)
        let message = `¡Hola! He realizado un pedido en A&D Suministros de Repostería y Panadería.\n\n`;
        message += `Detalle del Pedido:\n`;
        let total = 0;
        cart.forEach(item => {
            message += `- ${item.name} (x${item.quantity}) - Q${(item.price * item.quantity).toFixed(2)}\n`;
            total += item.price * item.quantity;
        });
        message += `\nTotal: Q${total.toFixed(2)}\n`;
        message += `Método de Pago: ${method}\n\n`;
        message += `¡Gracias!`;
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`;
    }

    function finalizeOrder(paymentMethod) {
        // ... (código igual que antes)
        if (cart.length === 0) {
            alert('Tu carrito está vacío. No se puede finalizar la compra.');
            return;
        }
        const whatsappLink = generateWhatsAppMessage(paymentMethod);
        window.open(whatsappLink, '_blank');
        cart = [];
        saveCart(); 
        renderProducts(); 
        cartModal.style.display = 'none';
        paymentModal.style.display = 'none';
        alert('Serás redirigido a WhatsApp para enviar tu pedido. ¡Gracias por tu compra!');
    }

    // --- Event Listeners Globales (igual que antes) ---
    viewCartBtn.addEventListener('click', () => { /* ... */ });
    // ... (copia el resto de los event listeners de la respuesta anterior)
    viewCartBtn.addEventListener('click', () => {
        cartModal.style.display = 'flex';
        updateCartDisplay();
    });
    closeCartBtn.addEventListener('click', () => cartModal.style.display = 'none');
    closeImageModalBtn.addEventListener('click', () => {
        imageModal.style.display = 'none';
        modalImage.src = '';
    });
    closePaymentModalBtn.addEventListener('click', () => paymentModal.style.display = 'none');
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }
        cartModal.style.display = 'none';
        paymentModal.style.display = 'flex';
    });
    payCashBtn.addEventListener('click', () => finalizeOrder('Efectivo'));
    payTransferBtn.addEventListener('click', () => finalizeOrder('Transferencia'));
    window.addEventListener('click', (event) => {
        if (event.target === cartModal) cartModal.style.display = 'none';
        if (event.target === imageModal) {
            imageModal.style.display = 'none';
            modalImage.src = '';
        }
        if (event.target === paymentModal) paymentModal.style.display = 'none';
    });

    // --- Inicialización (igual que antes) ---
    async function initializeApp() {
        // ... (código igual que antes)
        if (!storyblokApi) { 
            return;
        }
        if (!STORYBLOK_ACCESS_TOKEN || STORYBLOK_ACCESS_TOKEN === 'TU_ACCESS_TOKEN_DE_PREVISUALIZACION') {
            console.error("Storyblok Access Token no configurado.");
            productListDiv.innerHTML = '<p style="text-align: center; color: var(--rosa-pastel);">Error: Falta el Access Token de Storyblok.</p>';
            categoryFiltersDiv.innerHTML = '';
            return;
        }
        
        categories = await fetchCategoriesFromStoryblok();
        products = await fetchProductsFromStoryblok();
        
        renderCategoryFilters(); 
        renderProducts();       
        updateCartDisplay();    
        
        showInterface(userInterface); 
        if (cartModal) cartModal.style.display = 'none'; 
        if (imageModal) imageModal.style.display = 'none';
        if (paymentModal) paymentModal.style.display = 'none';
    }

    initializeApp();
});