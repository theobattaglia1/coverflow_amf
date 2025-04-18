describe('Public SPA', () => {
  before(() => {
    cy.visit('/');
    cy.wait(500);
  });

  it('displays cover elements', () => {
    cy.get('.cover', { timeout: 10000 }).should('exist');
  });

  it.skip('changes active cover with ArrowRight', () => {
    cy.get('.cover.active', { timeout: 10000 }).should('exist').then($a1 => {
      cy.get('body').type('{rightarrow}');
      cy.get('.cover.active', { timeout: 10000 }).should($a2 => {
        expect($a2[0]).not.to.equal($a1[0]);
      });
    });
  });

  it.skip('filter input narrows results', () => {
    cy.get('input', { timeout: 10000 }).should('exist').clear().type('nope');
    cy.get('.cover', { timeout: 10000 }).should('have.length', 0);
  });
});
