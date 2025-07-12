// client/src/pages/HomePage.js
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Pagination,
  Spinner,
  Alert,
} from "react-bootstrap";
import UserCard from "../components/UserCard";
import RequestModal from "../components/RequestModal";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const HomePage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/users/public", {
        params: {
          page: currentPage,
          limit: 6,
          search: searchTerm,
        },
      });

      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = (targetUser) => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = "/login";
      return;
    }

    setSelectedUser(targetUser);
    setShowRequestModal(true);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const items = [];

    for (let page = 1; page <= totalPages; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </Pagination.Item>
      );
    }

    return (
      <Pagination className="justify-content-center">
        <Pagination.Prev
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        />
        {items}
        <Pagination.Next
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        />
      </Pagination>
    );
  };

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center mb-4">Discover Skills & Connect</h1>
          <p className="text-center text-muted mb-4">
            Find people to exchange skills with and grow together
          </p>

          <Form.Control
            type="search"
            placeholder="Search by skills, name, or location..."
            value={searchTerm}
            onChange={handleSearch}
            className="mb-4"
          />
        </Col>
      </Row>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <Alert variant="info" className="text-center">
          {searchTerm
            ? "No users found matching your search."
            : "No users found."}
        </Alert>
      ) : (
        <>
          <Row className="g-4">
            {users.map((user) => (
              <Col key={user._id} md={6} lg={4}>
                <UserCard user={user} onSendRequest={handleSendRequest} />
              </Col>
            ))}
          </Row>

          <div className="mt-5">{renderPagination()}</div>
        </>
      )}

      <RequestModal
        show={showRequestModal}
        onHide={() => setShowRequestModal(false)}
        targetUser={selectedUser}
      />
    </Container>
  );
};

export default HomePage;
