
// client/src/pages/ProfilePage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    skillsOffered: [],
    skillsWanted: [],
    availability: 'Flexible',
    isPublic: true,
    profilePhoto: ''
  });
  const [skillInput, setSkillInput] = useState({ offered: '', wanted: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        location: user.location || '',
        skillsOffered: user.skillsOffered || [],
        skillsWanted: user.skillsWanted || [],
        availability: user.availability || 'Flexible',
        isPublic: user.isPublic !== undefined ? user.isPublic : true,
        profilePhoto: user.profilePhoto || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSkillInputChange = (e) => {
    setSkillInput({
      ...skillInput,
      [e.target.name]: e.target.value
    });
  };

  const addSkill = (type) => {
    const skill = skillInput[type].trim();
    if (skill && !formData[skills${type === 'offered' ? 'Offered' : 'Wanted'}].includes(skill)) {
      setFormData({
        ...formData,
        [skills${type === 'offered' ? 'Offered' : 'Wanted'}]: [
          ...formData[skills${type === 'offered' ? 'Offered' : 'Wanted'}],
          skill
        ]
      });
      setSkillInput({
        ...skillInput,
        [type]: ''
      });
    }
  };

  const removeSkill = (type, index) => {
    const skillType = skills${type === 'offered' ? 'Offered' : 'Wanted'};
    setFormData({
      ...formData,
      [skillType]: formData[skillType].filter((_, i) => i !== index)
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({
          ...formData,
          profilePhoto: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.put('/api/users/profile', formData);
      updateUser(response.data);
      toast.success('Profile updated successfully!');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">My Profile</h2>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={4} className="text-center mb-4">
                    <div className="mb-3">
                      {formData.profilePhoto ? (
                        <img 
                          src={formData.profilePhoto} 
                          alt="Profile"
                          className="profile-photo-large"
                        />
                      ) : (
                        <div 
                          className="profile-photo-large d-flex align-items-center justify-content-center bg-secondary text-white mx-auto"
                          style={{ fontSize: '2rem' }}
                        >
                          {getInitials(formData.name || 'U')}
                        </div>
                      )}
                    </div>
                    
                    <Form.Group>
                      <Form.Label className="btn btn-outline-primary">
                        Upload Photo
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </Form.Label>
                    </Form.Group>
                  </Col>
                  
                  <Col md={8}>
                    <Form.Group className="mb-3">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Location</Form.Label>
                      <Form.Control
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., San Francisco, CA"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Availability</Form.Label>
                      <Form.Select
                        name="availability"
                        value={formData.availability}
                        onChange={handleChange}
                      >
                        <option value="Flexible">Flexible</option>
                        <option value="Weekends">Weekends</option>
                        <option value="Evenings">Evenings</option>
                        <option value="Weekdays">Weekdays</option>
                      </Form.Select>
                    </Form.Group>

                    <Form.Check
                      type="checkbox"
                      name="isPublic"
                      label="Make my profile public"
                      checked={formData.isPublic}
                      onChange={handleChange}
                      className="mb-3"
                    />
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Skills I Offer</Form.Label>
                      <div className="d-flex mb-2">
                        <Form.Control
                          type="text"
                          name="offered"
                          value={skillInput.offered}
                          onChange={handleSkillInputChange}
                          placeholder="Add a skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill('offered');
                            }
                          }}
                        />
                        <Button 
                          variant="outline-primary" 
                          onClick={() => addSkill('offered')}
                          className="ms-2"
                        >
                          Add
                        </Button>
                      </div>
                      <div>
                        {formData.skillsOffered.map((skill, index) => (
                          <span key={index} className="skill-tag me-2 mb-2">
                            {skill}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-2"
                              style={{ fontSize: '0.5rem' }}
                              onClick={() => removeSkill('offered', index)}
                            />
                          </span>
                        ))}
                      </div>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Skills I Want</Form.Label>
                      <div className="d-flex mb-2">
                        <Form.Control
                          type="text"
                          name="wanted"
                          value={skillInput.wanted}
                          onChange={handleSkillInputChange}
                          placeholder="Add a skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill('wanted');
                            }
                          }}
                        />
                        <Button 
                          variant="outline-primary" 
                          onClick={() => addSkill('wanted')}
                          className="ms-2"
                        >
                          Add
                        </Button>
                      </div>
                      <div>
                        {formData.skillsWanted.map((skill, index) => (
                          <span key={index} className="skill-tag wanted me-2 mb-2">
                            {skill}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-2"
                              style={{ fontSize: '0.5rem' }}
                              onClick={() => removeSkill('wanted', index)}
                            />
                          </span>
                        ))}
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfilePage;
