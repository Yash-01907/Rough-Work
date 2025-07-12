
// client/src/pages/UserDetailPage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequestModal from '../components/RequestModal';
import axios from 'axios';

const UserDetailPage = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get(/api/users/${id});
      setUser(response.data);
    } catch (error) {
      setError('User not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = () => {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    setShowRequestModal(true);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading profile...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <Row>
                <Col md={4} className="text-center mb-4">
                  {user.profilePhoto ? (
                    <img 
                      src={user.profilePhoto} 
                      alt={user.name}
                      className="profile-photo-large"
                    />
                  ) : (
                    <div 
                      className="profile-photo-large d-flex align-items-center justify-content-center bg-secondary text-white mx-auto"
                      style={{ fontSize: '2rem' }}
                    >
                      {getInitials(user.name)}
                    </div>
                  )}
                </Col>
                
                <Col md={8}>
                  <h2>{user.name}</h2>
                  
                  {user.location && (
                    <p className="text-muted mb-3">
                      📍 {user.location}
                    </p>
                  )}
                  
                  <div className="mb-3">
                    <Badge bg="info" className="me-