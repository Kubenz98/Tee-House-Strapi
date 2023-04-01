"use strict";

/**
 * cart-item controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::cart-item.cart-item",
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;
      const entityId = ctx.request.body.data.product;
      const entries = await strapi.services["api::cart-item.cart-item"].find({
        filters: { user: user.id },
        populate: ["product"],
      });
      let itemToUpdate;
      for (const entry of entries.results) {
        if (entry.product.id === entityId) {
          itemToUpdate = entry;
          itemToUpdate.quantity++;
        }
      }
      ctx.request.body.data.user = ctx.state.user.id;
      let entity;
      if (!itemToUpdate) {
        ctx.request.body.data.quantity = 1;
        entity = await strapi.services["api::cart-item.cart-item"].create(
          ctx.request.body
        );
      } else {
        entity = await strapi.entityService.update(
          "api::cart-item.cart-item",
          itemToUpdate.id,
          {
            data: {
              quantity: itemToUpdate.quantity,
            },
          }
        );
      }
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },
    async find(ctx) {
      const user = ctx.state.user;
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        user: user.id,
      };
      return super.find(ctx);
    },
    async update(ctx) {
      const { action, id } = ctx.request.body;
      const entries = await strapi.services["api::cart-item.cart-item"].find({
        filters: { id },
      });
      console.log("[ENTRIES]:", entries);
      let entity;
      let updatedQuantity;

      if (action === "addOne") {
        updatedQuantity = entries.results[0].quantity + 1;
      } else if (action === "subtractOne") {
        updatedQuantity = entries.results[0].quantity - 1;
      }
      if (updatedQuantity > 0) {
        entity = await strapi.entityService.update(
          "api::cart-item.cart-item",
          id,
          {
            data: {
              quantity: updatedQuantity,
            },
          }
        );
      } else {
        entity = await strapi.entityService.delete(
          "api::cart-item.cart-item",
          id
        );
      }
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },
    async deleteAll(ctx) {
      const user = ctx.state.user.id;
      const toDelete = await strapi.db
        .query("api::cart-item.cart-item")
        .findMany({ where: { user } });
      const entity = strapi.db
        .query("api::cart-item.cart-item")
        .deleteMany({ where: { id: { $in: toDelete.map(({ id }) => id) } } });

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },
  })
);
