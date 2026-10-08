// Dữ liệu giả lập, lấy từ bản thiết kế html/index.html
const img = (id) => `https://lh3.googleusercontent.com/aida-public/${id}`;

export const me = {
  id: 'u_1',
  name: 'Minh Khang',
  email: 'demo@ai90.vn',
  avatarUrl: img('AB6AXuDo0QIMljZPOrahqGRobp6JkhfvR01JOvT3YQQ8UX3FiMTYoRvfZCLAbBwbp_9FmOex3vj8rE58pzJPTpVkkz7dYljtZzTvyQnRl1SKqiby2wiTnj5reM07ykSYdfKRhPZS1qbXdleXEi_6FNYeewVLwZLBL83TmuQSccGirXfEuKfv6lsPhel8yGsLPvjuygz8bi0cARgHD9V17okX2D8NucoAuwQPIlkcDWkPOKk'),
  credits: 120,
};

// Tài khoản dùng thử ở chế độ mock
export const demoAccount = { email: 'demo@ai90.vn', password: '123456' };

export const unreadNotifications = 3;

export const categories = [
  { id: 'c_fashion', slug: 'thoi-trang', name: 'Thời trang', icon: 'styler' },
  { id: 'c_shoes', slug: 'giay', name: 'Giày', icon: 'steps' },
  { id: 'c_bags', slug: 'tui-xach', name: 'Túi xách', icon: 'shopping_bag' },
  { id: 'c_cosmetics', slug: 'my-pham', name: 'Mỹ phẩm', icon: 'spa' },
  { id: 'c_jewelry', slug: 'trang-suc', name: 'Trang sức', icon: 'diamond' },
  { id: 'c_furniture', slug: 'noi-that', name: 'Nội thất', icon: 'chair' },
  { id: 'c_food', slug: 'do-an', name: 'Đồ ăn', icon: 'restaurant' },
  { id: 'c_electronics', slug: 'dien-tu', name: 'Điện tử', icon: 'devices' },
  { id: 'c_cars', slug: 'o-to', name: 'Ô tô', icon: 'directions_car' },
];

const cat = (slug) => {
  const c = categories.find((x) => x.slug === slug);
  return { slug: c.slug, name: c.name };
};

const authors = {
  huy: {
    name: 'Huy Studio AI',
    avatarUrl: img('AB6AXuA_65ODRpU7kKnaUq6dqoAFxZlLvr0yRXCXuV0oGg79EXy1wiXp_oEtGNcfBr1Mh5NkozaDifKsoj0k6o5aSlW0AWCC_fPho8P_NkB0Vh3nRRjAAwcOJbygTwkF2XLiilwYUgZXb668Ex-D330zxiJW-3-lqmc_zaYlbHveyuTngpGIrGKZBk8XO-oSStHLBM932i5GzFQvGIRzyrfg_O1m2VhS4vz8JcWjpVf4SDk'),
  },
  linh: {
    name: 'Linh Visuals',
    avatarUrl: img('AB6AXuCS-vjYekiVY670CZEQWYScCwAma91aMT-3v45Fcwu9RAWhzrfQ71l-m394mP6bP4RiWWZYVf6P3uwwI6hPGS7Ewbc3zj-FD0HQEiRLdNQFDwPYnKadahRnU4v5jue2k8Antz1O0fjyGmMXpsQbTGzOtaw1IOehgrDDD_VcVaT3rUWzZKGnKWtMVloky7QDFtWkEkqkzldRnuD3u0dh5FVEwQmZZpiwBZGfmGdP8fQ'),
  },
  bao: {
    name: 'Bảo Prompter',
    avatarUrl: img('AB6AXuBlLGYrrPPM1fReOYbPta8D64HlnM-hwSH4jKgxmpIhNBe3rXPuYGhHIXxj6kqgWmsGkNfZfekEGKCID-bN0Kay9S5Ume6yHcQ-twk0Mg23rHLDAzWuGjtyzuMY0o2fiJ1mPr_oCCiSId6Nv-vrqD4vSaNp6OoiQXVD0IavUBXmRuRm4YQjfWFePumQiDhv_pj7W-wbLjFydwHzvpMGkSnz-oF_xbJo7h2oYG7XyjQ'),
  },
};

export const creatives = [
  {
    id: 'cr_1',
    title: 'Chụp giày sneaker Studio Neon',
    description:
      'Ánh sáng studio neon xanh cobalt, phản chiếu trên mặt acrylic tối, phù hợp ảnh sản phẩm e-commerce cao cấp.',
    imageUrl: img('AB6AXuADHUXOZ62DJhITr3H3A2X2ASpRSXZdbm3-lievO3v-FeE0Am6hkeWZxyLQpeW9_Tsg9afFEeg6ydd_Qet0S6GTiryeqz2lBK-yh8fIvgxj_Qa2VWbFXK-JBeiWsW3-5RWyyMDi0cG2057XIDyagcW-3YoUs3pxM83_P_pKuqvpie-zZEKFOX8VdR0GCw4FwEhOhYMLQBeImiCdYWdjw4Qd7yLj_otJhaAR37RVp18'),
    rating: 4.9,
    price: 5,
    usageCount: 1200,
    suitableFor: 'Giày dép, Streetwear',
    category: cat('giay'),
    author: authors.huy,
  },
  {
    id: 'cr_2',
    title: 'Mỹ phẩm luxury mặt nước',
    description:
      'Chai serum chìm trong làn nước trong vắt, ánh nắng tự nhiên, cảm giác tươi mát và sang trọng.',
    imageUrl: img('AB6AXuDIRyOH9vUouFJS1P7HoPybUUnR7RTVDqEGx0-xC1OvWzOWVYwePtOPMcTxLdLhCN18BqWpAT761-lUKJcmJvHz5ZxhFCgdryKqnUaSAwML6AYk1Q3fkKSyciDR1pmimkvuamthwgyZU9AcUilYCN3_7bYYFYIi7Rx5yY4p1qD_4gnc1PuoQBi4L4uuXe1tTNi3PwEF-0ZhTUax1a_XqAaKiTBLOIKUp-wiXC-ehcM'),
    rating: 4.9,
    price: 5,
    usageCount: 2400,
    suitableFor: 'Mỹ phẩm, Skincare & Spa',
    category: cat('my-pham'),
    author: authors.linh,
  },
  {
    id: 'cr_3',
    title: 'Áo vest công sở cinematic',
    description:
      'Mannequin trong không gian kiến trúc brutalist, bóng đổ buổi sáng, phong cách editorial thời trang.',
    imageUrl: img('AB6AXuA_tMY65yrFi6IpICB0VJhOhvfXVx2C71Jek8ObfOQs3WqQEUS2wSx_ETy-7x-cE59s_vQLUxBaemow_VXSFJBKHJw5PE9gdviVNw26gssZyh28W2P8-PewxP6KtbObHAOE_cUTgjAwNhznMacTdO0VN4h1m6ZJl9mth79VfOBk7_ho9XUoDdCq4qPMGuRKObgkWZMP8BXOTPmYY_l1s1lm6xRd8WnnPg0EvR1-aZU'),
    rating: 4.8,
    price: 5,
    usageCount: 950,
    suitableFor: 'Thời trang Nam & Nữ',
    category: cat('thoi-trang'),
    author: authors.bao,
  },
  {
    id: 'cr_4',
    title: 'Cà phê sữa đá Retro Chill',
    description: 'Ly cà phê sữa đá giữa hạt cà phê rang, không khí quán cà phê boutique buổi sáng.',
    imageUrl: img('AB6AXuBHYnr9O32zJ7OWSULXN5wNKMLYtkX6da2MUzLtLd2OT8oV1naskS3BmIgGMpsRwI5Z3DoW_2WBnSyxI-NiHHg5vZWjdqv-5DrKZH_x60dgIp9Xq6W8GS-qpiBzvOTWs7SoSo68qETYOPnFrOul9rAb4CZqQIaXxPrqbCbPS8H9bvxyfZwztsOvV20dIZCjUM6mbeCpsVcBWILODTYmRwv2tphWu3GI3aJw5GFi_rk'),
    rating: 4.9,
    price: 3,
    usageCount: 3100,
    suitableFor: 'Đồ ăn & Uống',
    category: cat('do-an'),
    author: authors.huy,
  },
  {
    id: 'cr_5',
    title: 'Trang sức kim cương đá cẩm thạch',
    description: 'Vòng cổ kim cương trên đá cẩm thạch nhám, ánh sáng điện ảnh dịu nhẹ.',
    imageUrl: img('AB6AXuAchlhhjJf6e_NUQWKrw8nJGlH4IsqfvmkLt5r3rmSjXoAKC6tWIOzFcy30jATkrL9UO94xlxHzC7fS5dmf_MRcAy4_mH4xoQOX_JyLyxkSi8O3x7dA1RziUagDbdibeBqceCt0ECN15b1jYTWNLN50ctVfhPdlCMfRovzACTEGuvYkCCJVzMLcwrUOhoVUB2eQBpqhrK0om9GNjMSdW2MuLhy4XueIlYtBEYe8vIY'),
    rating: 5.0,
    price: 6,
    usageCount: 1800,
    suitableFor: 'Trang sức',
    category: cat('trang-suc'),
    author: authors.linh,
  },
  {
    id: 'cr_6',
    title: 'Túi xách da Podium Minimal',
    description: 'Túi da cao cấp trên bục kiến trúc, bóng cửa sổ mềm mại, ánh sáng studio thời trang.',
    imageUrl: img('AB6AXuDGE1M7OX6Nh4SIU_HcvZUdNa4HSYk2bMR9l3PJneCLkXjEYD2Ea_w1wWN5x2hLMxU604bvRDwBbdyZID8zqW5ZUDaBLK2-b59S-1i-sZhtqpsrA3UGUVv_xd8Y8DTlNbGkMCEtkAabVoWqP91SmF0GvDePS3gBvezPIERSXUurWpHCtfy5B8oHrXitzFOMlffIML8GeWaLW9Lkp40TjIJ9eW75UP4SQIym7IagCj0'),
    rating: 4.8,
    price: 4,
    usageCount: 1400,
    suitableFor: 'Túi xách, Phụ kiện',
    category: cat('tui-xach'),
    author: authors.bao,
  },
  {
    id: 'cr_7',
    title: 'Tai nghe công nghệ Cyber Float',
    description: 'Tai nghe lơ lửng trên bục kim loại, hiệu ứng hạt sáng, ánh sáng studio công nghệ.',
    imageUrl: img('AB6AXuBFgVf3fGf0BVFrjL2Jl-K8CuKVHVoDZGYLCdGRJUAKgraIiGDcbWKc_Vdn8-7ry6zsPwgdEsS8gLrV0GwX6whjgYKjeyzXmbo6-OwAoARvUoatPaqFBl1axFtnLguUmBHUfOK4wSg647ihSTNPCRIhHTQOpdFwwbHfAZ8U1Mlrrx0_haYfVLr8U53JAhK9VNkusTMCYP9LHACb3ypAhIUsO2sH2CnA6ZO3Kh-j4zY'),
    rating: 4.9,
    price: 5,
    usageCount: 2700,
    suitableFor: 'Điện tử, Công nghệ',
    category: cat('dien-tu'),
    author: authors.huy,
  },
];
