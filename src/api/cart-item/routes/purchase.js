module.exports = {
  routes: [
    {
      method: "DELETE",
      path: "/purchase",
      handler: "cart-item.deleteAll",
      config: {
        policies: [],
      },
    },
  ],
};
