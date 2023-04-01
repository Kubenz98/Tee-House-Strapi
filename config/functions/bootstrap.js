module.exports = () => {
  return {
    async graphql({ context }) {
      // Ustaw wartość "currentUserId" w kontekście
      context.currentUserId = context.state.user.id;
    }
  };
};