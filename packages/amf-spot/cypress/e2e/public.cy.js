describe('Public SPA', () => {
  before(() => {
    cy.visit('/');
    // give the page half a second to hydrate
    cy.wait(500);
  });

  it('displays cover elements', () => {
    cy.get('.cover', { timeout: 10000 }).should('exist');
  });

  it('changes active cover with ArrowRight', () => {
    // wait for the active class to appear
    cy.get('.cover.active', { timeout: 10000 }).should('exist').then($a1 => {
      cy.get('body').type('{rightarrow}');
      // now the active cover must be different
      cy.get('.cover.active', { timeout: 10000 }).should($a2 => {
        expect($a2[0]).not.to.equal($a1[0]);
      });
    });
  });

  it('filter input narrows results', () => {
    // look for any input (the one in #filter-ui)
    cy.get('input', { timeout: 10000 }).should('exist').clear().type('nope');
    // after typing something that matches nothing, covers = []
    cy.get('.cover', { timeout: 10000 }).should('have.length', 0);
  });
});
