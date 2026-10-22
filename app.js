(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.BOZOR_CONFIG || {};
  const configured = config.supabaseUrl && !config.supabaseUrl.includes("YOUR-PROJECT") &&
    config.supabaseKey && !config.supabaseKey.includes("YOUR_SUPABASE");
  const db = configured && window.supabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;
  const storageKey = "bozor_guest_v1";
  // Older mobile browsers may not implement crypto.randomUUID(); never let that stop all UI handlers.
  function createId(){try{if(window.crypto&&typeof window.crypto.randomUUID==="function")return window.crypto.randomUUID();}catch(e){}return "guest-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}
  const guest = (() => { try { let v = JSON.parse(localStorage.getItem(storageKey)); if(v?.id && v?.name) return v; } catch(e){} const v={id:createId(),name:"Пользователь"}; try{localStorage.setItem(storageKey,JSON.stringify(v));}catch(e){} return v; })();
  let products=[], activeCategory="Все", activeProduct=null, activeChat=null, chatChannel=null, realtimeChannel=null, imageData=null, toastTimer=null;
  let currentTheme="day"; try { currentTheme=localStorage.getItem("bozor_theme")||"day"; } catch(e) {}
  const themeNames={day:{ru:"День",uz:"Kun",en:"Day",icon:"☀"},dawn:{ru:"Утро",uz:"Tong",en:"Morning",icon:"🌅"},night:{ru:"Ночь",uz:"Tun",en:"Night",icon:"☾"}};
  function applyTheme(){document.body.dataset.theme=currentTheme;const v=themeNames[currentTheme]||themeNames.day;$("#themeIcon").textContent=v.icon;$("#themeLabel").textContent=v[currentLanguage]||v.en;$("#themeToggle").title=(currentLanguage==="uz"?"Mavzuni almashtirish":currentLanguage==="en"?"Change theme":"Сменить тему");}
  $("#themeToggle").addEventListener("click",()=>{currentTheme=({day:"dawn",dawn:"night",night:"day"})[currentTheme]||"day";localStorage.setItem("bozor_theme",currentTheme);applyTheme();});
  let authUser=null, authMode="login", awaitingPhoneOtp=false;
  function updateProfileLabel(){const label=$("#profileLabel");if(!label)return;label.textContent=authUser?(authUser.user_metadata?.name||guest.name||"Аккаунт"):(currentLanguage==="uz"?"Kirish":currentLanguage==="en"?"Sign in":"Войти");}
  function authStatus(message,type=""){const el=$("#authStatus");el.textContent=message;el.classList.remove("hidden","error","success");if(type)el.classList.add(type);}
  function setAuthMode(mode){authMode=mode;awaitingPhoneOtp=false;$("#authPassword").disabled=false;$("#authPhone").readOnly=false;$("#authOtp").value="";$("#authNameWrap").classList.toggle("hidden",mode!=="signup");$("#authOtpWrap").classList.add("hidden");$("#authOtp").required=false;$("#authModeSwitch").classList.remove("hidden");$("#authForm").classList.remove("hidden");$("#authLogout").classList.add("hidden");$("#authHeading").textContent=mode==="signup"?"Создать аккаунт":"Войти в Bozor";$("#authIntro").textContent=mode==="signup"?"Один аккаунт — твои объявления и переписки на разных устройствах.":"Войди по номеру телефона и паролю, чтобы открыть свой аккаунт с любого устройства.";$("#authSubmit").textContent=mode==="signup"?"Создать аккаунт":"Войти";$("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("#authStatus").classList.add("hidden");$("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));}
  function showAccount(){if(authUser){$("#authHeading").textContent="Ты в Bozor";$("#authIntro").textContent=(authUser.user_metadata?.name||guest.name||"Пользователь")+" · "+(authUser.phone||"");$("#authModeSwitch").classList.add("hidden");$("#authForm").classList.add("hidden");$("#authLogout").classList.remove("hidden");$("#authStatus").classList.add("hidden");}else setAuthMode("login");openModal("authModal");}
  $("#profileNav").addEventListener("click",showAccount);
  $("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));
  function applyAuthenticatedUser(user){authUser=user||null;if(user){guest.id=user.id;guest.name=user.user_metadata?.name||guest.name||"Пользователь";}else{guest.id=createId();guest.name="Пользователь";}try{localStorage.setItem(storageKey,JSON.stringify(guest));}catch(e){}updateProfileLabel();}
  async function restoreAuth(){if(!db){updateProfileLabel();return;}const {data,error}=await db.auth.getSession();if(error)console.error(error);applyAuthenticatedUser(data?.session?.user||null);db.auth.onAuthStateChange((_event,session)=>{applyAuthenticatedUser(session?.user||null);listProducts().catch(console.error);renderMyOffers().catch(console.error);});}
  $("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!db){authStatus("Вход недоступен: Supabase не подключён.","error");return;}const button=$("#authSubmit");button.disabled=true;button.textContent="Подождите…";$("#authStatus").classList.add("hidden");const phone=$("#authPhone").value.trim().replace(/[\s()-]/g,"");const password=$("#authPassword").value;
    try{
      if(awaitingPhoneOtp){const token=$("#authOtp").value.trim();if(!/^\d{6}$/.test(token))throw new Error("Введи 6-значный код из SMS.");const {data,error}=await db.auth.verifyOtp({phone,token,type:"sms"});if(error)throw error;applyAuthenticatedUser(data.user);closeModal("authModal");toast("Номер подтверждён. Ты вошёл в Bozor.");await listProducts();await renderMyOffers();return;}
      if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error("Введи номер в международном формате, например +998901234567.");
      if(password.length<8)throw new Error("Пароль должен содержать минимум 8 символов.");
      if(authMode==="signup"){
        const name=$("#authName").value.trim();if(!name)throw new Error("Введи имя, которое увидят другие пользователи.");
        const {data,error}=await db.auth.signUp({phone,password,options:{data:{name}}});if(error)throw error;
        if(data.session){applyAuthenticatedUser(data.user);closeModal("authModal");toast("Аккаунт создан. Добро пожаловать в Bozor!");await listProducts();await renderMyOffers();}
        else{awaitingPhoneOtp=true;$("#authNameWrap").classList.add("hidden");$("#authPassword").disabled=true;$("#authPhone").readOnly=true;$("#authOtpWrap").classList.remove("hidden");$("#authOtp").required=true;$("#authModeSwitch").classList.add("hidden");$("#authHeading").textContent="Подтверди номер";$("#authIntro").textContent="Мы запросили SMS-код. Введи его, чтобы активировать аккаунт.";$("#authSubmit").textContent="Подтвердить номер";authStatus("Код отправлен, если SMS-провайдер настроен в Supabase.","success");}
      }else{
        const {data,error}=await db.auth.signInWithPassword({phone,password});if(error)throw error;applyAuthenticatedUser(data.user);closeModal("authModal");toast("Ты вошёл в свой аккаунт Bozor.");await listProducts();await renderMyOffers();
      }
    }catch(err){console.error(err);authStatus(err.message||"Не удалось выполнить вход. Проверь номер и пароль.","error");}
    finally{button.disabled=false;if(!awaitingPhoneOtp)button.textContent=authMode==="signup"?"Создать аккаунт":"Войти";else button.textContent="Подтвердить номер";}
  });
  $("#authLogout").addEventListener("click",async()=>{try{const {error}=await db.auth.signOut();if(error)throw error;applyAuthenticatedUser(null);closeModal("authModal");toast("Ты вышел из аккаунта.");await listProducts();await renderMyOffers();}catch(err){authStatus("Не удалось выйти: "+err.message,"error");}});

  const dictionaries = {
    ru:{brandSub:"Маркетплейс Узбекистана",searchPlaceholder:"Что ищем сегодня?",messages:"Сообщения",sell:"＋ Разместить",heroEyebrow:"ПОКУПАЙ · ПРОДАВАЙ · ДОГОВАРИВАЙСЯ",heroTitle:'Найди своё.<br><span>Продай своё.</span>',heroCopy:"Объявления рядом, прямые сообщения и честный торг — в одном месте.",heroButton:"Разместить объявление",heroArt:"Твоя следующая находка",catAll:"Все товары",catPhones:"Телефоны",catComputers:"Компьютеры",catAccessories:"Аксессуары",catGames:"Игры",catWatches:"Часы",catOther:"Другое",fresh:"СВЕЖИЕ ОБЪЯВЛЕНИЯ",productsForYou:"Товары для тебя",checking:"Проверяем подключение…",loading:"Загружаем каталог…",yourOffers:"ТВОИ ПРЕДЛОЖЕНИЯ",myBargaining:"Мой торг",footerSub:"Торговля становится проще",footerLine:"Покупай разумно. Продавай легко.",newListing:"НОВОЕ ОБЪЯВЛЕНИЕ",whatSell:"Что продаёшь?",productName:"Название товара",productPlaceholder:"Например, iPhone 13",price:"Цена (сум)",category:"Категория",description:"Описание",descriptionPlaceholder:"Состояние, комплектация и другое",productPhoto:"Фото товара",photoHint:"Фото сожмётся перед отправкой. Не загружай документы или личные данные.",yourName:"Твоё имя",namePlaceholder:"Как к тебе обращаться",publish:"Опубликовать объявление",myMessages:"Мои сообщения",all:"Все",phones:"Телефоны",computers:"Компьютеры",accessories:"Аксессуары",games:"Игры",watches:"Часы",other:"Другое",cloud:"Облачная база подключена",demo:"Демо-режим: подключи Supabase",emptyTitle:"Пока нет объявлений",emptyText:"Стань первым продавцом на Bozor.",notFound:"Ничего не найдено",tryOther:"Попробуй другое название.",writeSeller:"✉ Написать продавцу",makeOffer:"Предложить цену",viewOffers:"Посмотреть предложения",seller:"Продавец",noDescription:"У продавца пока нет описания.",messagePlaceholder:"Напиши сообщение…",publishing:"Публикуем…",sellerPrice:"Цена продавца",enterOffer:"Введи свою цену в сумах",invalidPrice:"Введи корректную цену.",samePrice:"Это та же цена. Можно написать продавцу.",offerSent:"Предложение отправлено продавцу."},
    uz:{brandSub:"O‘zbekiston marketplace’i",searchPlaceholder:"Nimani qidiramiz?",messages:"Xabarlar",sell:"＋ E’lon berish",heroEyebrow:"XARID QIL · SOT · KELISH",heroTitle:'O‘zingga mosini<br><span>top va sot.</span>',heroCopy:"E’lonlar, bevosita xabarlar va narx kelishuvi — barchasi bir joyda.",heroButton:"E’lon joylash",heroArt:"Keyingi topilmang",catAll:"Barcha tovarlar",catPhones:"Telefonlar",catComputers:"Kompyuterlar",catAccessories:"Aksessuarlar",catGames:"O‘yinlar",catWatches:"Soatlar",catOther:"Boshqa",fresh:"YANGI E’LONLAR",productsForYou:"Siz uchun tovarlar",checking:"Ulanish tekshirilmoqda…",loading:"Katalog yuklanmoqda…",yourOffers:"SIZNING TAKLIFLARINGIZ",myBargaining:"Savdolashuvlarim",footerSub:"Savdo yanada oson",footerLine:"Oqilona xarid qiling. Oson soting.",newListing:"YANGI E’LON",whatSell:"Nima sotmoqchisiz?",productName:"Tovar nomi",productPlaceholder:"Masalan, iPhone 13",price:"Narxi (so‘m)",category:"Toifa",description:"Tavsif",descriptionPlaceholder:"Holati, to‘plami va boshqalar",productPhoto:"Tovar rasmi",photoHint:"Rasm yuborishdan oldin siqiladi. Hujjat yoki shaxsiy ma’lumot yuklamang.",yourName:"Ismingiz",namePlaceholder:"Ismingizni kiriting",publish:"E’lonni joylash",myMessages:"Xabarlarim",all:"Barchasi",phones:"Telefonlar",computers:"Kompyuterlar",accessories:"Aksessuarlar",games:"O‘yinlar",watches:"Soatlar",other:"Boshqa",cloud:"Bulutli baza ulangan",demo:"Demo rejim: Supabase ulang",emptyTitle:"Hozircha e’lonlar yo‘q",emptyText:"Bozorda birinchi sotuvchi bo‘ling.",notFound:"Hech narsa topilmadi",tryOther:"Boshqa nom bilan qidiring.",writeSeller:"✉ Sotuvchiga yozish",makeOffer:"Narx taklif qilish",viewOffers:"Takliflarni ko‘rish",seller:"Sotuvchi",noDescription:"Sotuvchi hali tavsif qo‘shmagan.",messagePlaceholder:"Xabar yozing…",publishing:"Joylanmoqda…",sellerPrice:"Sotuvchi narxi",enterOffer:"Narxingizni so‘mda kiriting",invalidPrice:"To‘g‘ri narx kiriting.",samePrice:"Bu ayni narx. Sotuvchiga yozishingiz mumkin.",offerSent:"Taklif sotuvchiga yuborildi."},
    en:{brandSub:"Uzbekistan Marketplace",searchPlaceholder:"What are you looking for?",messages:"Messages",sell:"＋ Sell item",heroEyebrow:"BUY · SELL · NEGOTIATE",heroTitle:'Find your next<br><span>great deal.</span>',heroCopy:"Local listings, direct messages, and fair price negotiation — all in one place.",heroButton:"Post a listing",heroArt:"Your next great find",catAll:"All items",catPhones:"Phones",catComputers:"Computers",catAccessories:"Accessories",catGames:"Games",catWatches:"Watches",catOther:"Other",fresh:"FRESH LISTINGS",productsForYou:"Picked for you",checking:"Checking connection…",loading:"Loading listings…",yourOffers:"YOUR OFFERS",myBargaining:"My offers",footerSub:"Trading made simpler",footerLine:"Shop smart. Sell easily.",newListing:"NEW LISTING",whatSell:"What are you selling?",productName:"Item name",productPlaceholder:"For example, iPhone 13",price:"Price (UZS)",category:"Category",description:"Description",descriptionPlaceholder:"Condition, what's included, and more",productPhoto:"Item photo",photoHint:"The image is compressed before upload. Don’t upload documents or personal data.",yourName:"Your name",namePlaceholder:"How should buyers address you?",publish:"Publish listing",myMessages:"My messages",all:"All items",phones:"Phones",computers:"Computers",accessories:"Accessories",games:"Games",watches:"Watches",other:"Other",cloud:"Cloud database connected",demo:"Demo mode: connect Supabase",emptyTitle:"No listings yet",emptyText:"Be the first seller on Bozor.",notFound:"Nothing found",tryOther:"Try another search.",writeSeller:"✉ Message seller",makeOffer:"Make an offer",viewOffers:"View offers",seller:"Seller",noDescription:"The seller hasn’t added a description yet.",messagePlaceholder:"Write a message…",publishing:"Publishing…",sellerPrice:"Seller price",enterOffer:"Enter your offer in UZS",invalidPrice:"Enter a valid price.",samePrice:"That is the same price. You can message the seller.",offerSent:"Offer sent to seller."}
  };
  let currentLanguage = "ru"; try { currentLanguage = localStorage.getItem("bozor_language") || "ru"; } catch(e) {}
  const t = key => (dictionaries[currentLanguage] || dictionaries.ru)[key] || dictionaries.ru[key] || key;
  const translatedCategory = c => ({Все:t("all"),Телефоны:t("phones"),Компьютеры:t("computers"),Аксессуары:t("accessories"),Игры:t("games"),Часы:t("watches"),Другое:t("other")})[c] || c || t("other");
  function applyLanguage(){
    document.documentElement.lang=currentLanguage;
    document.querySelectorAll("[data-i18n]").forEach(el=>{const value=t(el.dataset.i18n);if(value.includes("<br>")||value.includes("<span>"))el.innerHTML=value;else el.textContent=value;});
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
    const catLabels={Все:"catAll",Телефоны:"catPhones",Компьютеры:"catComputers",Аксессуары:"catAccessories",Игры:"catGames",Часы:"catWatches",Другое:"catOther"};
    document.querySelectorAll(".category[data-category]").forEach(el=>{const label=el.querySelector("span");if(label)label.textContent=t(catLabels[el.dataset.category]||"catOther");});
    const categoryOptions=[...$("#productCategory").options];categoryOptions.forEach(o=>{o.textContent=translatedCategory(o.value);});
    $("#languageSelect").value=currentLanguage;
    applyTheme();updateProfileLabel();
    renderProducts();
  }
  $("#languageSelect").addEventListener("change",e=>{currentLanguage=e.target.value;localStorage.setItem("bozor_language",currentLanguage);applyLanguage();});

  const iconFor = c => ({Телефоны:"📱",Компьютеры:"💻",Аксессуары:"🎧",Игры:"🎮",Часы:"⌚",Другое:"📦"})[c] || "📦";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => Number(n||0).toLocaleString(currentLanguage==="en"?"en-US":currentLanguage==="uz"?"uz-UZ":"ru-RU")+" "+(currentLanguage==="en"?"UZS":currentLanguage==="uz"?"so‘m":"сум");
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add("hidden"),3600);}
  function notice(msg){$("#notice").textContent=msg;$("#notice").classList.remove("hidden");}
  function hideNotice(){$("#notice").classList.add("hidden");}
  function setConnection(ok){const e=$("#connectionStatus");e.classList.toggle("online",!!ok);e.innerHTML="<i></i> "+(ok?t("cloud"):t("demo"));}
  function openModal(id){$("#"+id).classList.remove("hidden");document.body.style.overflow="hidden";}
  function closeModal(id){$("#"+id).classList.add("hidden");if(!$$(".modal:not(.hidden)").length)document.body.style.overflow="";}
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  $$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
  function localGet(k,fallback=[]){try{return JSON.parse(localStorage.getItem("bozor_"+k)||"null")??fallback}catch(e){return fallback}}
  function localSet(k,v){localStorage.setItem("bozor_"+k,JSON.stringify(v))}
  async function listProducts(){
    if(db){const {data,error}=await db.from("products").select("*").eq("status","active").order("created_at",{ascending:false}).limit(100);if(error)throw error;products=data||[];}
    else products=localGet("products",[]);
    renderProducts();
  }
  function renderProducts(){
    const term=$("#searchInput").value.trim().toLowerCase();
    const list=products.filter(p=>(activeCategory==="Все"||p.category===activeCategory)&&(!term||`${p.title} ${p.description} ${p.category}`.toLowerCase().includes(term)));
    $("#productGrid").innerHTML=list.length?list.map(p=>`<article class="product-card" data-product="${esc(p.id)}"><div class="product-image">${p.image_url?`<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.title)}">`:`<span class="placeholder">${iconFor(p.category)}</span>`}<span class="product-category">${esc(translatedCategory(p.category||"Другое"))}</span></div><div class="product-info"><h3>${esc(p.title)}</h3><div class="price">${money(p.price)}</div><div class="seller-line"><span class="avatar">${esc((p.seller_name||"П")[0].toUpperCase())}</span><span>${esc(p.seller_name||t("seller"))}</span></div></div></article>`).join(""):`<div class="empty"><strong>${term?t("notFound"):t("emptyTitle")}</strong>${term?t("tryOther"):t("emptyText")}</div>`;
    $$(".product-card").forEach(card=>card.addEventListener("click",()=>showProduct(card.dataset.product)));
  }
  function openSell(){imageData=null;$("#productForm").reset();$("#sellerName").value=guest.name==="Пользователь"?"":guest.name;openModal("productModal");}
  async function compressImage(file){
    if(!file)return null;if(!file.type.startsWith("image/"))throw new Error("Выбери файл изображения.");
    return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL("image/jpeg",.72));};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Не удалось прочитать изображение."));};img.src=url;});
  }
  $("#productImage").addEventListener("change",async e=>{try{imageData=await compressImage(e.target.files[0]);}catch(err){toast(err.message);e.target.value="";}});
  $("#productForm").addEventListener("submit",async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;button.textContent=t("publishing")||"Публикуем…";
    try{
      const row={title:$("#productTitle").value.trim(),price:Number($("#productPrice").value),category:$("#productCategory").value,description:$("#productDescription").value.trim(),seller_id:guest.id,seller_name:$("#sellerName").value.trim(),image_url:imageData,status:"active"};
      if(!row.title||!row.price||row.price<1||!row.seller_name)throw new Error("Заполни название, цену и имя.");
      guest.name=row.seller_name;localStorage.setItem(storageKey,JSON.stringify(guest));
      if(db){const {error}=await db.from("products").insert(row);if(error)throw error;}
      else{const data=localGet("products",[]);data.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()});localSet("products",data);}
      closeModal("productModal");await listProducts();toast(db?"Объявление опубликовано для всех пользователей.":"Сохранено только на этом устройстве. Подключи Supabase, чтобы объявление увидели другие.");hideNotice();
    }catch(err){console.error(err);toast("Не удалось опубликовать: "+(err.message||"проверь подключение и SQL"));}finally{button.disabled=false;button.textContent=t("publish");}
  });
  function isOwnProduct(p){return p.seller_id===guest.id || (!!guest.name && guest.name!=="Пользователь" && String(p.seller_name||"").trim().toLocaleLowerCase()===String(guest.name).trim().toLocaleLowerCase());}
  function showProduct(id){
    const p=products.find(x=>String(x.id)===String(id));if(!p)return;activeProduct=p;
    $("#detailContent").innerHTML=`<p class="eyebrow">${esc(translatedCategory(p.category||"Другое"))}</p><h2>${esc(p.title)}</h2><div class="detail-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:`<span class="placeholder">${iconFor(p.category)}</span>`}</div><div class="detail-price">${money(p.price)}</div><div class="seller-line"><span class="avatar">${esc((p.seller_name||"П")[0].toUpperCase())}</span><span>${esc(t("seller"))}: <b>${esc(p.seller_name||t("seller"))}</b></span></div><p class="detail-description">${esc(p.description||t("noDescription"))}</p><div class="detail-actions">${isOwnProduct(p)?`<button class="nav-button" id="viewProductOffers">${t("viewOffers")}</button>`:`<button class="nav-button" id="messageSeller">${t("writeSeller")}</button><button class="primary" id="makeOffer">${t("makeOffer")}</button>`}</div>`;
    openModal("detailModal");
    $("#messageSeller")?.addEventListener("click",()=>startChat(p));
    $("#makeOffer")?.addEventListener("click",()=>offerPrice(p));
    $("#viewProductOffers")?.addEventListener("click",()=>{closeModal("detailModal");loadOffersForSeller(p);});
  }
  async function startChat(p){
    if(isOwnProduct(p)){toast(currentLanguage==="uz"?"Bu sizning e’loningiz.":currentLanguage==="en"?"This is your listing.":"Это твоё объявление.");return;}
    activeChat={productId:p.id,productTitle:p.title,otherId:p.seller_id,otherName:p.seller_name,ownerId:p.seller_id,ownerName:p.seller_name};
    $("#chatTitle").textContent=p.title;closeModal("detailModal");openModal("chatModal");subscribeChat();await loadChat();
  }
  function subscribeChat(){
    if(!db || !activeChat)return;
    if(chatChannel){db.removeChannel(chatChannel);chatChannel=null;}
    chatChannel=db.channel("bozor-chat-"+String(activeChat.productId)+"-"+guest.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"product_id=eq."+activeChat.productId},()=>loadChat().catch(console.error))
      .subscribe();
  }
  async function loadChat(){
    $("#chatMessages").innerHTML='<div class="empty">Загружаем переписку…</div>';
    try{
      let rows=[];
      if(db){let q=db.from("messages").select("*").eq("product_id",activeChat.productId).order("created_at",{ascending:true}).limit(200);const {data,error}=await q;if(error)throw error;rows=data||[];}
      else rows=localGet("messages",[]).filter(m=>m.product_id===activeChat.productId&&(m.sender_id===guest.id||m.receiver_id===guest.id));
      $("#chatMessages").innerHTML=rows.length?rows.map(m=>`<div class="bubble ${m.sender_id===guest.id?"mine":""}"><small>${esc(m.sender_name||"Пользователь")} · ${new Date(m.created_at||Date.now()).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})}</small>${esc(m.body)}</div>`).join(""):'<div class="empty">Пока нет сообщений. Напиши первым!</div>';
      $("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
    }catch(err){console.error(err);$("#chatMessages").innerHTML='<div class="empty">Не удалось загрузить сообщения. Проверь настройки Supabase.</div>';}
  }
  $("#chatForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!activeChat)return;const body=$("#messageInput").value.trim();if(!body)return;
    const receiver=guest.id===activeChat.ownerId?findBuyerForCurrentChat():activeChat.ownerId;
    const row={product_id:activeChat.productId,product_title:activeChat.productTitle,sender_id:guest.id,sender_name:guest.name,receiver_id:receiver,receiver_name:activeChat.otherName||activeChat.ownerName||"Собеседник",body};
    try{
      if(db){const {error}=await db.from("messages").insert(row);if(error)throw error;}
      else{const all=localGet("messages",[]);all.push({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()});localSet("messages",all);}
      $("#messageInput").value="";await loadChat();
    }catch(err){console.error(err);toast("Сообщение не отправлено: "+(err.message||"ошибка базы данных"));}
  });
  function findBuyerForCurrentChat(){return activeChat.otherId||activeChat.ownerId;}
  async function openInbox(){
    openModal("inboxModal");$("#inboxList").innerHTML='<div class="empty">Загружаем сообщения…</div>';
    try{
      let rows=[];
      if(db){const {data,error}=await db.from("messages").select("*").or(`sender_id.eq.${guest.id},receiver_id.eq.${guest.id}`).order("created_at",{ascending:false}).limit(300);if(error)throw error;rows=data||[];}
      else rows=localGet("messages",[]).filter(m=>m.sender_id===guest.id||m.receiver_id===guest.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      const grouped=new Map();rows.forEach(m=>{const key=m.product_id+"|"+(m.sender_id===guest.id?m.receiver_id:m.sender_id);if(!grouped.has(key))grouped.set(key,m);});
      const items=[...grouped.values()];
      $("#inboxList").innerHTML=items.length?items.map(m=>{const other=m.sender_id===guest.id?m.receiver_name||"Собеседник":m.sender_name;return `<div class="inbox-item" data-product="${esc(m.product_id)}" data-other="${esc(m.sender_id===guest.id?m.receiver_id:m.sender_id)}" data-name="${esc(other)}"><strong>${esc(m.product_title||"Объявление")}</strong><span>${esc(other)} · ${esc(m.body)}</span></div>`}).join(""):'<div class="empty"><strong>Пока нет сообщений</strong>Открой товар и нажми «Написать продавцу».</div>';
      $$(".inbox-item").forEach(item=>item.addEventListener("click",async()=>{const p=products.find(x=>String(x.id)===item.dataset.product);activeChat={productId:item.dataset.product,productTitle:p?.title||"Объявление",otherId:item.dataset.other,otherName:item.dataset.name,ownerId:p?.seller_id||item.dataset.other,ownerName:p?.seller_name||item.dataset.name};closeModal("inboxModal");$("#chatTitle").textContent=activeChat.productTitle;openModal("chatModal");subscribeChat();await loadChat();}));
    }catch(err){console.error(err);$("#inboxList").innerHTML='<div class="empty">Не удалось загрузить сообщения. Проверь SQL и настройки базы.</div>';}
  }
  async function offerPrice(p){
    const raw=prompt(`Цена продавца: ${money(p.price)}\nВведи свою цену в сумах:`);if(raw===null)return;const price=Number(raw.replace(/\s/g,""));
    if(!Number.isFinite(price)||price<1){toast(t("invalidPrice"));return;}
    if(price===Number(p.price)){toast(t("samePrice"));return;}
    const row={product_id:p.id,buyer_id:guest.id,buyer_name:guest.name,seller_id:p.seller_id,price,status:"pending"};
    try{if(db){const {error}=await db.from("offers").insert(row);if(error)throw error;}else{const a=localGet("offers",[]);a.unshift({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()});localSet("offers",a);}
      toast(t("offerSent"));await renderMyOffers();
    }catch(err){console.error(err);toast("Не удалось отправить торг: "+(err.message||"ошибка базы"));}
  }
  async function loadOffersForSeller(p){
    $("#myOffersSection").classList.remove("hidden");$("#myOffersSection").scrollIntoView({behavior:"smooth"});
    try{let offers=[];if(db){const {data,error}=await db.from("offers").select("*").eq("product_id",p.id).eq("seller_id",guest.id).order("created_at",{ascending:false});if(error)throw error;offers=data||[];}else offers=localGet("offers",[]).filter(o=>o.product_id===p.id&&o.seller_id===guest.id);
      $("#myOffers").innerHTML=offers.length?offers.map(o=>offerHtml(o,true)).join(""):'<div class="empty">Пока нет предложений по этому товару.</div>';wireOfferButtons();
    }catch(err){toast("Не удалось загрузить торг: "+err.message);}
  }
  function offerHtml(o,asSeller=false){const p=products.find(x=>String(x.id)===String(o.product_id));const label=o.status==="accepted"?"Принято":o.status==="rejected"?"Отклонено":"Ожидает ответа";return `<div class="offer-row"><div><strong>${esc(p?.title||"Товар")} — ${money(o.price)}</strong><p>${asSeller?"От покупателя: "+esc(o.buyer_name||"Покупатель"):"Статус: "+label} · ${label}</p></div>${asSeller&&o.status==="pending"?`<div class="offer-actions"><button class="small-btn accept" data-offer="${esc(o.id)}" data-status="accepted">Принять</button><button class="small-btn reject" data-offer="${esc(o.id)}" data-status="rejected">Отклонить</button></div>`:""}</div>`;}
  async function renderMyOffers(){
    const section=$("#myOffersSection");section.classList.remove("hidden");
    try{let offers=[];if(db){const {data,error}=await db.from("offers").select("*").or(`buyer_id.eq.${guest.id},seller_id.eq.${guest.id}`).order("created_at",{ascending:false}).limit(100);if(error)throw error;offers=data||[];}else offers=localGet("offers",[]).filter(o=>o.buyer_id===guest.id||o.seller_id===guest.id);
      $("#myOffers").innerHTML=offers.length?offers.map(o=>offerHtml(o,o.seller_id===guest.id)).join(""):'<div class="empty">Ты ещё не отправлял предложения и не получал их.</div>';wireOfferButtons();
    }catch(err){console.error(err);$("#myOffers").innerHTML='<div class="empty">Не удалось загрузить предложения. Проверь настройки Supabase.</div>';}
  }
  function wireOfferButtons(){$$("[data-offer][data-status]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{if(db){const {error}=await db.from("offers").update({status:b.dataset.status,updated_at:new Date().toISOString()}).eq("id",b.dataset.offer).eq("seller_id",guest.id).eq("status","pending");if(error)throw error;}else{const a=localGet("offers",[]).map(o=>o.id===b.dataset.offer&&o.seller_id===guest.id&&o.status==="pending"?{...o,status:b.dataset.status,updated_at:new Date().toISOString()}:o);localSet("offers",a);}toast(b.dataset.status==="accepted"?"Предложение принято.":"Предложение отклонено.");await renderMyOffers();}catch(err){toast("Не удалось обновить предложение: "+err.message);}finally{b.disabled=false;}}));}
  $("#searchInput").addEventListener("input",renderProducts);
  $$(".category").forEach(b=>b.addEventListener("click",()=>{$$(".category").forEach(x=>x.classList.toggle("active",x===b));activeCategory=b.dataset.category;renderProducts();}));
  $("#sellNav").addEventListener("click",openSell);$("#heroSell").addEventListener("click",openSell);$("#chatNav").addEventListener("click",openInbox);
  applyLanguage();
  async function init(){
    await restoreAuth();
    if(!db){setConnection(false);notice("Сайт пока работает в демо-режиме. Чтобы товары, сообщения и торг работали между разными телефонами, настрой config.js и выполни supabase.sql в SQL Editor Supabase.");await listProducts().catch(()=>{});return;}
    try{await listProducts();setConnection(true);hideNotice();
      realtimeChannel=db.channel("bozor-live").on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>listProducts().catch(console.error)).on("postgres_changes",{event:"*",schema:"public",table:"offers"},()=>renderMyOffers()).subscribe();
    }catch(err){setConnection(false);notice("Не удалось подключить базу: "+err.message+" Проверь URL, ключ, SQL-таблицы и политики доступа.");console.error(err);}
    await renderMyOffers();
  }
  init();
})();