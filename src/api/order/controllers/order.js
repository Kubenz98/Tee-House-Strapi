"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async find(ctx) {
    try {
      //find user cart items
      const user = ctx.state.user;
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        user: user.id,
      };
      return await super.find(ctx);
    } catch (err) {
      console.error(err);
      ctx.response.status = 500;
      ctx.send({ error: "Internal server error" });
    }
  },
}));
