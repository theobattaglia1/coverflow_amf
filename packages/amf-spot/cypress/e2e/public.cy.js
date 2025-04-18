describe('Public SPA', () => {
  before(() => {
    cy.visit('/');
  });

  it('displays cover elements', () => {
    cy.get('.cover').should('exist');
  });

  it('changes active cover with ArrowRight', () => {
    cy.get('.cover.active').should('exist').then($a1 => {
      cy.get('body').type('{rightarrow}');
      cy.get('.cover.active').should($a2 => {
        expect($a2[0]).not.to.equal($a1[0]);
      });
    });
  });

  it('filter input narrows results', () => {
    cy.get('#filter-ui input')
      .should('exist')
      .clear()
      .type('nope')
      .then(()=>{
        cy.get('.cover').should('have.length',0);
      });
  });
});
