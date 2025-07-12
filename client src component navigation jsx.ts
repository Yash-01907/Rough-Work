// client/src/components/Navbar.js
import React from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Navbar bg="white" expand="lg" className="shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/">
          🔄 SkillSwap
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">
              Home
            </Nav.Link>
            {user && (
              <>
                <Nav.Link as={Link} to="/profile">
                  Profile
                </Nav.Link>
                <Nav.Link as={Link} to="/requests">
                  Requests
                </Nav.Link>
              </>
            )}
          </Nav>
          <Nav>
            {user ? (
              <div className="d-flex align-items-center">
                <span className="me-3">Welcome, {user.name}!</span>
                <Button variant="outline-primary" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  variant="outline-primary"
                  as={Link}
                  to="/login"
                  className="me-2"
                >
                  Login
                </Button>
                <Button variant="primary" as={Link} to="/register">
                  Register
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
