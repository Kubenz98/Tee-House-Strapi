"use strict";

/**
 * cart-item controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::cart-item.cart-item",
  ({ strapi }) => ({
    async create(ctx) {
      //create cart item
      const user = ctx.state.user;
      const entityId = ctx.request.body.data.product;
      try {
        // checking if cart exists
        const cartInitial = await strapi.services["api::cart.cart"].find({
          filters: { user: user.id },
          populate: ["product"],
        });
        let createdCart;
        if (!cartInitial.results.length) {
          //if cart not exist, create one
          createdCart = await strapi.entityService.create("api::cart.cart", {
            data: {
              user: user.id,
            },
          });
        }
        //find that user have a cart item
        const cartItems = await strapi.services[
          "api::cart-item.cart-item"
        ].find({
          filters: { user: user.id },
          populate: ["product"],
        });
        let itemToUpdate;
        //if cart item exists, add quantity
        for (const entry of cartItems.results) {
          if (entry.product.id === entityId) {
            itemToUpdate = entry;
            itemToUpdate.quantity++;
            itemToUpdate.price = entry.quantity * entry.product.price;
          }
        }
        ctx.request.body.data.user = ctx.state.user.id;
        let cartEntity = await strapi.services["api::cart.cart"].find({
          filters: { user: user.id },
          populate: ["product"],
        });
        //if cart item not exists, create one
        if (!itemToUpdate) {
          ctx.request.body.data.quantity = 1;
          const product = await strapi.services["api::product.product"].find({
            filters: { id: ctx.request.body.data.product },
          });
          ctx.request.body.data.price = product.results[0].price;
          const cartItem = await strapi.services[
            "api::cart-item.cart-item"
          ].create(ctx.request.body);
          const item = await strapi.services["api::cart-item.cart-item"].find({
            filters: { id: cartItem.id },
            populate: ["product"],
          });
          const cart = await strapi.services["api::cart.cart"].find({
            filters: { user: user.id },
            populate: ["cartItems"],
          });
          const updatedItems = [...cart.results[0].cartItems, cartItem.id];
          cartEntity = await strapi.entityService.update(
            "api::cart.cart",
            !!cartInitial.results.length
              ? cartInitial.results[0].id
              : createdCart.id,
            {
              data: {
                totalAmount:
                  cartEntity.results[0].totalAmount +
                  item.results[0].product.price,
                cartItems: updatedItems,
              },
            }
          );
        } else {
          await strapi.entityService.update(
            "api::cart-item.cart-item",
            itemToUpdate.id,
            {
              data: {
                quantity: itemToUpdate.quantity,
                price: itemToUpdate.price,
              },
            }
          );
          const cartItems = await strapi.services[
            "api::cart-item.cart-item"
          ].find({
            filters: { user: user.id },
            populate: ["product"],
          });
          let totalAmount = cartItems.results
            .reduce((sum, item) => sum + item.price, 0)
            .toFixed(2);
          cartEntity = await strapi.entityService.update(
            "api::cart.cart",
            cartInitial.results[0].id,
            {
              data: {
                totalAmount,
              },
            }
          );
        }
        const sanitizedEntity = await this.sanitizeOutput(cartEntity, ctx);
        return this.transformResponse(sanitizedEntity);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },

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

    async update(ctx) {
      //updating cart item quantity
      const user = ctx.state.user;
      const { action, id } = ctx.request.body;
      try {
        const entries = await strapi.services["api::cart-item.cart-item"].find({
          filters: { id },
          populate: { product: true },
        });
        const cartToUpdate = await strapi.db.query("api::cart.cart").findOne({
          where: { user: user.id },
        });
        let entity;
        let updatedQuantity;
        let updatedPrice;
        if (action === "addOne") {
          updatedQuantity = entries.results[0].quantity + 1;
          updatedPrice = entries.results[0].product.price * updatedQuantity;
        } else if (action === "subtractOne") {
          updatedQuantity = entries.results[0].quantity - 1;
          updatedPrice = entries.results[0].product.price * updatedQuantity;
        }
        if (updatedQuantity > 0) {
          entity = await strapi.entityService.update(
            "api::cart-item.cart-item",
            id,
            {
              data: {
                quantity: updatedQuantity,
                price: updatedPrice,
              },
            }
          );
          const allCartItems = await strapi.services[
            "api::cart-item.cart-item"
          ].find({
            filters: { user: user.id },
            populate: ["product"],
          });
          let totalAmount = allCartItems.results
            .reduce((sum, item) => sum + item.price, 0)
            .toFixed(2);
          await strapi.entityService.update("api::cart.cart", cartToUpdate.id, {
            data: {
              totalAmount,
            },
          });
        } else {
          entity = await strapi.entityService.delete(
            "api::cart-item.cart-item",
            id
          );
          const cartItems = await strapi.services[
            "api::cart-item.cart-item"
          ].find({
            filters: { user: user.id },
          });
          if (!cartItems.results.length) {
            await strapi.db.query("api::cart.cart").delete({
              where: { user: user.id },
            });
          } else {
            let totalAmount = cartItems.results
              .reduce((sum, item) => sum + item.price, 0)
              .toFixed(2);
            await strapi.entityService.update(
              "api::cart.cart",
              cartToUpdate.id,
              {
                data: {
                  totalAmount,
                },
              }
            );
          }
        }
        const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
        return this.transformResponse(sanitizedEntity);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },

    async purchase(ctx) {
      const user = ctx.state.user.id;
      const checkoutData = JSON.stringify(ctx.request.body);
      try {
        const userCarItems = await strapi.db
          .query("api::cart-item.cart-item")
          .findMany({ where: { user }, populate: { product: true } })
          .then((r) => {
            const items = r.map((item) => {
              return {
                id: item.id,
                quantity: item.quantity,
                price: item.quantity * item.product.price,
                product: item.product.id,
              };
            });
            return items;
          })
          .catch((err) => console.error(err));

        const order = await strapi.entityService.create("api::order.order", {
          data: {
            user,
          },
        });
        const promises = userCarItems.map(async (item) => {
          return strapi.entityService.create("api::order-item.order-item", {
            data: {
              user,
              quantity: item.quantity,
              price: item.price,
              product: item.product,
            },
          });
        });
        const orderItems = await Promise.all(promises);
        let totalAmount = orderItems
          .reduce((sum, item) => sum + item.price, 0)
          .toFixed(2);
        await strapi.entityService.update("api::order.order", order.id, {
          data: {
            totalAmount,
            orderItems,
            checkout: checkoutData,
          },
        });
        const entries = await strapi.entityService.findMany("api::order.order");
        await strapi.db.query("api::cart-item.cart-item").deleteMany({
          where: { id: { $in: userCarItems.map(({ id }) => id) } },
        });
        await strapi.db.query("api::cart.cart").delete({
          where: { user },
        });
        return ctx.send([]);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },
  })
);
