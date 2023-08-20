module.exports = {
  routes: [
    {
      method: "PATCH",
      path: "/purchase",
      handler: "cart-item.purchase",
      config: {
        policies: [],
      },
    },
  ],
};
